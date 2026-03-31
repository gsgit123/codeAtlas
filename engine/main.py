from fastapi import FastAPI
from dotenv import load_dotenv
import os
from pydantic import BaseModel

from parser.dispatcher import process_project
from graph.builder import build_project_graph

load_dotenv()
app=FastAPI()

class ParseRequest(BaseModel):
    project_id:str
    folder_path:str


@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.post("/api/parse")
def trigger_parsing(request:ParseRequest):
    print(f"received parsing request for project: {request.project_id}")
    try:
        parsed_data=process_project(request.folder_path)

        graph=build_project_graph(parsed_data)

        return {
            "message": "Graph built successfully!", 
            "total_nodes": len(graph.nodes),
            "total_edges": sum(len(edges) for edges in graph.adj.values()),
            "cycles_detected": len(graph.detect_cycles()),
            "nodes_data": graph.nodes
        }
    except Exception as e:
        return{
            "message":"Parsing failed",
            "error":str(e)
        }




