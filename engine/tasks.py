import os
import shutil
import requests
from celery import Celery
from dotenv import load_dotenv
from groq import Groq

from graph.neo4j_client import Neo4jClient
from parser.dispatcher import process_project
from graph.builder import build_project_graph
from rag.chunker import build_chunks
from rag.embedder import embed_chunks
from rag.vector_store import get_or_create_collection, add_chunks
from query.graph_retriever import structural_query

load_dotenv()

celery_app = Celery(
    "codeatlas_worker",
    broker=os.getenv("REDIS_URL"),
    backend=os.getenv("REDIS_URL")
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    broker_connection_retry_on_startup=True
)

neo4j_client = Neo4jClient()

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

@celery_app.task(name="tasks.run_parsing_pipeline")
def run_parsing_pipeline_task(project_id: str, folder_path: str):
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
        if os.path.exists(folder_path):
            try:
                shutil.rmtree(folder_path)
                print(f"[Cleanup] Deleted extracted folder: {folder_path}")
            except Exception as cleanup_err:
                print(f"[Cleanup] Failed to delete {folder_path}: {cleanup_err}")
