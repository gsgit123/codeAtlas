import os
import json 
import re
import numpy as np 
from groq import Groq
from dotenv import load_dotenv

from query.router import classify_query
from query.graph_retriever import impact_query, trace_query, structural_query
from rag.retriever import retrieve
from rag.embedder import embed_text
from rag.vector_store import get_or_create_collection

import redis

load_dotenv()
groq_client=Groq(api_key=os.getenv("GROQ_API_KEY"))

raw_url = os.getenv("REDIS_URL")
clean_url = raw_url.split("?")[0] if "?" in raw_url else raw_url
redis_client = redis.from_url(clean_url, decode_responses=True, ssl_cert_reqs="none")

CACHE_LIMIT=50
CACHE_THRESHOLD=0.93

def cosine_similarity(a:list,b:list)->float:
    a,b=np.array(a),np.array(b)
    return float(np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)))

def cache_lookup(project_id: str, query_vector: list):
    cache_key = f"codeatlas_cache:{project_id}"
    cached_items = redis_client.lrange(cache_key, 0, -1)
    
    for item_str in cached_items:
        try:
            item = json.loads(item_str)
            if cosine_similarity(query_vector, item["vector"]) > CACHE_THRESHOLD:
                print("[Cache] Redis Cache Hit! Returning instant answer.")
                return item["answer"]
        except:
            continue
    return None

def cache_store(project_id: str, query_vector: list, answer: dict):
    cache_key = f"codeatlas_cache:{project_id}"
    item = json.dumps({
        "vector": query_vector,
        "answer": answer
    })
    
    # Push to list and trim to maintain limit
    redis_client.lpush(cache_key, item)
    redis_client.ltrim(cache_key, 0, CACHE_LIMIT - 1)
    # Expire cache after 24 hours to keep Redis clean
    redis_client.expire(cache_key, 86400)


PROMPT_TEMPLATE = """You are CodeAtlas, an expert AI code analyst. 
You have been given context from a real codebase to answer the user's question.
## Relevant Code Chunks (from semantic search)
{rag_context}
## Dependency Graph Context
{graph_context}
## User Question
{question}
Instructions:
- Answer using ONLY the provided context above
- Be specific — mention exact function names, file names, and line numbers
- If the context doesn't contain enough info, say so clearly
- Keep the answer focused and technical
End your answer with EXACTLY these two lines (no exceptions):
FILES_USED: [comma separated list of file paths you referenced]
NODES_USED: [comma separated list of function/node names you referenced]"""


def build_prompt(question:str,rag_chunks:list,graph_context:str)->str:
    rag_parts=[]
    for i,chunk in enumerate(rag_chunks):
        rag_parts.append(
            f"### Chunk {i+1} ({chunk['metadata']['name']} in {chunk['metadata']['file']})\n"
            f"{chunk['text'][:500]}"

        )
    rag_context="\n\n".join(rag_parts) if rag_parts else "No relevant code chunks found."

    return PROMPT_TEMPLATE.format(
        rag_context=rag_context,
        graph_context=graph_context if graph_context else "No graph context available",
        question=question
    )


def parse_citations(answer: str) -> tuple:
    files_used = []
    nodes_used = []

    # Match with OR without square brackets — handles both Groq output formats
    files_match = re.search(r"FILES_USED:\s*\[?([^\]\n]+)\]?", answer, re.IGNORECASE)
    nodes_match = re.search(r"NODES_USED:\s*\[?([^\]\n]+)\]?", answer, re.IGNORECASE)

    if files_match:
        raw = files_match.group(1).strip().strip("[]")
        files_used = [f.strip() for f in raw.split(",") if f.strip()]
    if nodes_match:
        raw = nodes_match.group(1).strip().strip("[]")
        nodes_used = [n.strip() for n in raw.split(",") if n.strip()]

    return files_used, nodes_used


# detect_mentioned_files removed because Pinecone does not support dumping the DB.


#full query
def run_query(project_id:str,question:str):
    print(f"\n========== New Query ==========")
    print(f"Question: {question}")

    #check redis cache
    query_vector=embed_text(question)
    cached=cache_lookup(project_id, query_vector)
    if cached:
        cached["is_cached"] = True
        return cached

    #classify question
    route=classify_query(question)
    print(f"[Router] Route: {route}")

    #rag retrieval
    collection=get_or_create_collection(project_id)

    # Standard dense vector retrieval via Pinecone
    rag_chunks = retrieve(question, collection, top_k=5)

    #graph retrieval
    graph_context=""
    try:
        if route=="impact":
            words=question.split()
            file_hint = next((w for w in words if "." in w), "")
            if file_hint:
                result = impact_query(project_id, file_hint)
                graph_context = result["context"]

        elif route=="trace":
            result = structural_query(project_id)
            graph_context = result["context"]

        elif route=="structural":
            result = structural_query(project_id)
            graph_context = result["context"]

    except Exception as e:
        print(f"  [Engine] Graph retrieval failed: {e}")
        graph_context = ""

    #build prompt
    prompt=build_prompt(question,rag_chunks,graph_context)
    print(f"  [Engine] Calling Groq...")

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.2
    )
    answer = response.choices[0].message.content

    #parse citations
    files_used, nodes_used = parse_citations(answer)
    result = {
        "question":   question,
        "route":      route,
        "answer":     answer,
        "files_used": files_used,
        "nodes_used": nodes_used,
        "chunks_used": len(rag_chunks),
        "is_cached":  False
    }
    cache_store(project_id, query_vector, result)
    return result


