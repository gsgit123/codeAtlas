from fastapi import FastAPI
from dotenv import load_dotenv
import os
from pydantic import BaseModel

from parser.dispatcher import process_project

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

        return{
            "message":"Parsing sussessful",
            "files analysed": len(parsed_data),
            "data":parsed_data
        }
    except Exception as e:
        return{
            "message":"Parsing failed",
            "error":str(e)
        }




