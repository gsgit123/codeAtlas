from fastapi import FastAPI
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from graph.neo4j_client import Neo4jClient

from rag.vector_store import get_or_create_collection, search_chunks, delete_collection
from query.router import classify_query
from query.graph_retriever import impact_query, trace_query, structural_query, get_reactflow_graph, get_file_content
from rag.retriever import retrieve
from query.engine import run_query

from tasks import run_parsing_pipeline_task

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
def trigger_parsing(request:ParseRequest):
    run_parsing_pipeline_task.delay(request.project_id, request.folder_path)
    return {"message": "Parsing pipeline queued successfully in Celery worker"}

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
