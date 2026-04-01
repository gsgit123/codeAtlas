from fastapi import FastAPI,BackgroundTasks
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from graph.neo4j_client import Neo4jClient

from parser.dispatcher import process_project
from graph.builder import build_project_graph
from rag.chunker import build_chunks
from rag.embedder import embed_chunks
from rag.vector_store import get_or_create_collection, add_chunks
import requests

load_dotenv()
app=FastAPI()
neo4j_client=Neo4jClient()

class ParseRequest(BaseModel):
    project_id:str
    folder_path:str


@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.post("/api/parse")
def trigger_parsing(request:ParseRequest,background_tasks:BackgroundTasks):
    background_tasks.add_task(run_parsing_pipeline, request.project_id, request.folder_path)
    
    return {"message": "Parsing pipeline queued successfully"}

def run_parsing_pipeline(project_id: str, folder_path: str):
    try:
        print(f"[1/4] Parsing files for {project_id}...")
        parsed_data = process_project(folder_path)

        print("[2/4] Building Dependency Graph...")
        graph = build_project_graph(parsed_data)
        neo4j_client.store_project_graph(project_id, graph)

        print("[3/4] Chunking and Embedding code...")
        chunks = build_chunks(parsed_data, project_id)
        print(f"      Generated {len(chunks)} chunks. Embedding now...")
        embeddings = embed_chunks(chunks)

        print("[4/4] Storing vectors in ChromaDB...")
        collection = get_or_create_collection(project_id)
        add_chunks(collection, chunks, embeddings)

        print("Pipeline Fully Completed! Updating status...")
        requests.patch(
            f"http://localhost:3000/api/projects/{project_id}/status",
            json={"status": "ready"}
        )

    except Exception as e:
        print(f"Pipeline Failed: {str(e)}")
        requests.patch(
            f"http://localhost:3000/api/projects/{project_id}/status",
            json={"status": "error"}
        )



@app.get("/api/test-chroma/{project_id}")
def test_chroma(project_id: str):
    from rag.vector_store import get_or_create_collection
    collection = get_or_create_collection(project_id)
    count = collection.count()
    return {"project_id": project_id, "chunks_stored": count}
