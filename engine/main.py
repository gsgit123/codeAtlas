from fastapi import FastAPI,BackgroundTasks
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from graph.neo4j_client import Neo4jClient

from parser.dispatcher import process_project
from graph.builder import build_project_graph
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

def run_parsing_pipeline(project_id:str,folder_path:str):
    try:
        print(f"Background Task: Starting parsing for {project_id}")
        parsed_data = process_project(folder_path)
        
        print("Background Task: Building Graph...")
        graph = build_project_graph(parsed_data)
        
        print("Background Task: Pushing to Neo4j...")
        neo4j_client.store_project_graph(project_id, graph)

        print("Background Task: Done! Updating Node.js database...")

        requests.patch(
            f"http://localhost:3000/api/projects/{project_id}/status",
            json={"status": "ready"}
        )
        print("Pipeline Fully Completed!")
    except Exception as e:
        print(f"Pipeline Failed: {str(e)}")
        requests.patch(
            f"http://localhost:3000/api/projects/{project_id}/status",
            json={"status": "error"}
        )
        


