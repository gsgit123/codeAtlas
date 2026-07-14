from fastapi import FastAPI, BackgroundTasks
from dotenv import load_dotenv
import os
import shutil
from pydantic import BaseModel
from graph.neo4j_client import Neo4jClient

from parser.dispatcher import process_project
from graph.builder import build_project_graph
from rag.chunker import build_chunks
from rag.embedder import embed_chunks
from rag.vector_store import get_or_create_collection, add_chunks, search_chunks, delete_collection
from query.router import classify_query
from query.graph_retriever import impact_query, trace_query, structural_query, get_reactflow_graph, get_file_content
from rag.retriever import retrieve
from query.engine import run_query
from groq import Groq


import requests

load_dotenv()
app=FastAPI()
neo4j_client=Neo4jClient()

class ParseRequest(BaseModel):
    project_id:str
    folder_path:str

class QueryRequest(BaseModel):
    project_id:str
    question:str

class RouteTestRequest(BaseModel):
    question: str

class GraphQueryRequest(BaseModel):
    project_id: str
    file_name: str


@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.post("/api/parse")
def trigger_parsing(request:ParseRequest,background_tasks:BackgroundTasks):
    background_tasks.add_task(run_parsing_pipeline, request.project_id, request.folder_path)
    
    return {"message": "Parsing pipeline queued successfully"}

def update_status(project_id: str, status: str = None, text: str = None, percent: int = None, summary: str = None):
    node_url = os.getenv("NODE_URL", "http://localhost:3000")
    payload = {}
    if status: payload["status"] = status
    if text: payload["progress_text"] = text
    if percent is not None: payload["progress_percent"] = percent
    if summary is not None: payload["summary"] = summary
    try:
        requests.patch(f"{node_url}/api/projects/{project_id}/status", json=payload)
    except Exception as e:
        print("Failed to update Node server:", e)

def run_parsing_pipeline(project_id: str, folder_path: str):
    try:
        print(f"[1/4] Parsing files for {project_id}...")
        update_status(project_id, text="Parsing files and extracting source code...", percent=25)
        parsed_data = process_project(folder_path)

        print("[2/4] Building Dependency Graph...")
        update_status(project_id, text="Building Neo4j dependency graph...", percent=50)
        graph = build_project_graph(parsed_data)
        neo4j_client.store_project_graph(project_id, graph)

        print("[3/4] Chunking and Embedding code...")
        update_status(project_id, text="Chunking files and generating AI embeddings...", percent=75)
        chunks = build_chunks(parsed_data, project_id)
        print(f"      Generated {len(chunks)} chunks. Embedding now...")
        embeddings = embed_chunks(chunks)

        print("[4/4] Storing vectors in Pinecone Cloud...")
        update_status(project_id, text="Uploading vectors to Pinecone Cloud...", percent=90)
        collection = get_or_create_collection(project_id)
        add_chunks(collection, chunks, embeddings)

        print("[5/5] Generating AI Architecture Summary...")
        update_status(project_id, text="Generating AI Architecture Summary...", percent=95)
        try:
            struct_data = structural_query(project_id)
            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
            prompt = (
                f"Based on this codebase structure, write a single-sentence architecture summary (max 15 words) "
                f"describing what this codebase likely is, focusing on the main tech stack.\n\n"
                f"{struct_data['context']}"
            )
            res = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
                temperature=0.2
            )
            summary = res.choices[0].message.content.strip().strip('"')
            print(f"Summary Generated: {summary}")
        except Exception as e:
            print(f"Failed to generate summary: {e}")
            summary = ""

        print("Pipeline Fully Completed! Updating status...")
        update_status(project_id, status="ready", text="Ready", percent=100, summary=summary)

    except Exception as e:
        print(f"Pipeline Failed: {str(e)}")
        update_status(project_id, status="error", text=f"Error: {str(e)}")

    finally:
        # Fix #8: Always clean up the extracted uploads folder to prevent disk fill-up
        if os.path.exists(folder_path):
            try:
                shutil.rmtree(folder_path)
                print(f"[Cleanup] Deleted extracted folder: {folder_path}")
            except Exception as cleanup_err:
                print(f"[Cleanup] Failed to delete {folder_path}: {cleanup_err}")



@app.get("/api/test-chroma/{project_id}")
def test_chroma(project_id: str):
    from rag.vector_store import get_or_create_collection
    collection = get_or_create_collection(project_id)
    count = collection.count()
    return {"project_id": project_id, "chunks_stored": count}


@app.post("/api/test-retrieve")
def test_retrieve(req:QueryRequest):
    collection=get_or_create_collection(req.project_id)
    all_results=collection.get(include=["metadatas","documents"])
    all_chunks = [
        {
            "text":       all_results["documents"][i],
            "file":       all_results["metadatas"][i].get("file", ""),
            "name":       all_results["metadatas"][i].get("name", ""),
            "type":       all_results["metadatas"][i].get("type", ""),
            "start_line": all_results["metadatas"][i].get("start_line", 0),
            "end_line":   all_results["metadatas"][i].get("end_line", 0),
            "language":   all_results["metadatas"][i].get("language", ""),
            "project_id": all_results["metadatas"][i].get("project_id", "")
        }
        for i in range(len(all_results["documents"]))
    ]
    top_chunks=retrieve(req.question,collection,all_chunks)

    return {
        "question":req.question,
        "top_chunks_found":len(top_chunks),
        "results":[
            {
                "function": c["metadata"]["name"],
                "file":     c["metadata"]["file"],
                "lines":    f"{c['metadata']['start_line']}-{c['metadata']['end_line']}",
                "preview":  c["text"][:200]
            }
            for c in top_chunks
        ]
    }


@app.post("/api/test-router")
def test_router(req:RouteTestRequest):
    label=classify_query(req.question)
    return {"question":req.question,"classified_as":label}

@app.post("/api/test-impact")
def test_impact(req:GraphQueryRequest):
    result=impact_query(req.project_id,req.file_name)
    return result

@app.get("/api/test-structural/{project_id}")
def test_structural(project_id: str):
    result = structural_query(project_id)
    return result

@app.post("/api/query")
def query_endpoint(req:QueryRequest):
    result=run_query(req.project_id,req.question)
    return result

@app.get("/api/graph/{project_id}")
def get_graph(project_id: str):
    result = get_reactflow_graph(project_id)
    return result

@app.get("/api/file/{project_id}")
def get_file(project_id: str, path: str):
    result = get_file_content(project_id, path)
    return result

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    try:
        neo4j_client.delete_project_graph(project_id)
        delete_collection(project_id)
        return {"message": "Project data deleted from Neo4j and Pinecone."}
    except Exception as e:
        print(f"Error deleting project: {e}")
        return {"error": "Failed to delete project data from engine."}
