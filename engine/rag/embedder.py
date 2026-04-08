import os
import requests
from dotenv import load_dotenv
import time

load_dotenv()

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
API_URL = "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5"
HEADERS = {"Authorization": f"Bearer {HF_API_KEY}"}


def embed_text(text: str) -> list:
    response = requests.post(API_URL, headers=HEADERS, json={"inputs": [text]})
    return response.json()[0]

def embed_chunks(chunks: list, batch_size: int = 50) -> list:
    embeddings = []
    # We can use larger batches now because HF rate limits are much better
    for i in range(0, len(chunks), batch_size):
        batch = [chunk["text"] for chunk in chunks[i : i + batch_size]]
        response = requests.post(API_URL, headers=HEADERS, json={"inputs": batch})
        batch_embeddings = response.json()
        
        # If HF returns an error (like model loading or bad API key), crash loudly with the real reason
        if isinstance(batch_embeddings, dict) and "error" in batch_embeddings:
            raise Exception(f"HuggingFace API Error: {batch_embeddings['error']}")
            
        embeddings.extend(batch_embeddings)
        
    return embeddings
