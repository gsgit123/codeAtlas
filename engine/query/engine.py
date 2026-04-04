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

load_dotenv()
groq_client=Groq(api_key=os.getenv("GROQ_API_KEY"))

#cache
_cache=[]
CACHE_LIMIT=50
CACHE_THRESHOLD=0.93
def cosine_similarity(a:list,b:list)->float:
    a,b=np.array(a),np.array(b)
    return float(np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)))

def cache_lookup(query_vector:list):
    for vec,answer in _cache:
        if cosine_similarity(query_vector,vec)>CACHE_THRESHOLD:
            print("[Cache] Cache hit! Returning cached answer.")
            return answer
    return None

def cache_store(query_vector:list,answer:str):
    if(len(_cache)>=CACHE_LIMIT):
        _cache.pop(0)
    _cache.append((query_vector,answer))


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


#full query

def run_query(project_id:str,question:str):
    print(f"\n========== New Query ==========")
    print(f"Question: {question}")

    #check cache
    query_vector=embed_text(question)
    cached=cache_lookup(query_vector)
    if cached:
        return cached
    

    #classify question
    route=classify_query(question)
    print(f"[Router] Route: {route}")

    #rag retrieval
    collection=get_or_create_collection(project_id)
    all_results=collection.get(include=["metadatas","documents"])
    all_chunks=[
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
    rag_chunks=retrieve(question,collection,all_chunks,top_k=5)


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
        "chunks_used": len(rag_chunks)
    }
    # Store in cache for future similar questions
    cache_store(query_vector, result)

    return result


