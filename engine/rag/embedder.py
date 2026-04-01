from google import genai
from google.genai import types
import os
import time
from dotenv import load_dotenv

load_dotenv()

# New SDK client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def embed_text(text: str) -> list:
    """Embeds a single string into a vector using Gemini."""
    response = client.models.embed_content(
        model    = "gemini-embedding-001",
        contents = text
    )
    return response.embeddings[0].values

def embed_chunks(chunks: list, batch_size: int = 10) -> list:
    """
    Embeds a list of chunks in batches.
    Sleeps between batches to respect Gemini's free tier rate limits.
    """
    embeddings = []

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        print(f"  Embedding batch {i // batch_size + 1} ({len(batch)} chunks)...")

        for chunk in batch:
            embedding = embed_text(chunk["text"])
            embeddings.append(embedding)

        # Respect Gemini free tier rate limits
        if i + batch_size < len(chunks):
            time.sleep(1)

    return embeddings
