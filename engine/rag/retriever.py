import os
import numpy as np 
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from groq import Groq
from dotenv import load_dotenv
from rag.embedder import embed_text
from rag.vector_store import search_chunks

load_dotenv()

groq_client=Groq(api_key=os.getenv("GROQ_API_KEY"))

reranker=CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

##hyde
def hyde_embed(query:str)->list:
    print(" hyde generating hypothetical code snippet")
    response=groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{
            "role": "user",
            "content": (
                f"Write a short code function or explanation that directly answers:\n"
                f"{query}\n\n"
                f"Output ONLY the code/explanation. No extra text."
            )
        }],
        max_tokens=300,
        temperature=0.3
    )
    hypothesis=response.choices[0].message.content
    print(f"  [HyDE] Hypothesis preview: {hypothesis[:80]}...")
    return embed_text(hypothesis)



##hybrid search
def reciprocal_rank_fusion(vector_hits: list, bm25_hits: list, k: int = 60) -> list:
    scores = {}
    for rank, hit in enumerate(vector_hits):
        doc_id = hit["metadata"]["name"] + hit["metadata"]["file"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        hit["_rrf_id"] = doc_id
    for rank, hit in enumerate(bm25_hits):
        doc_id = hit["metadata"]["name"] + hit["metadata"]["file"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        hit["_rrf_id"] = doc_id

    seen = set()
    merged = []
    for hit in vector_hits + bm25_hits:
        doc_id = hit["_rrf_id"]
        if doc_id not in seen:
            seen.add(doc_id)
            hit["rrf_score"] = scores[doc_id]
            merged.append(hit)
    return sorted(merged, key=lambda x: x["rrf_score"], reverse=True)


def hybrid_search(query:str,hyde_vector:list,collection,all_chunks:list,top_k:int=20)->list:
    print("performing vector search")
    
    vector_hits=search_chunks(collection,hyde_vector,top_k=top_k)
    
    print("running bm25 search")
    corpus=[chunk["text"].lower().split() for chunk in all_chunks]
    bm25=BM25Okapi(corpus)
    bm25_scores=bm25.get_scores(query.lower().split())


    bm25_hits=[]
    for i, score in sorted(enumerate(bm25_scores), key=lambda x: -x[1])[:top_k]:
        if score > 0:
            chunk = all_chunks[i]
            bm25_hits.append({
                "text": chunk["text"],
                "metadata": {
                    "file": chunk["file"],
                    "name": chunk["name"],
                    "type": chunk["type"],
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"],
                    "language": chunk["language"],
                    "project_id": chunk["project_id"]
                },
                "distance": 1 - score / (max(bm25_scores) + 1e-9)
            })
    
    print("merging result with rrf")
    return reciprocal_rank_fusion(vector_hits,bm25_hits)



def rerank(query:str,hits:list,top_k:int=5)->list:
    print(f"  [Rerank] Scoring {len(hits)} candidates...")
    if not hits:
        return []
    pairs=[(query,hit["text"]) for hit in hits]
    scores=reranker.predict(pairs)
    
    ranked=sorted(zip(scores,hits),key=lambda x:x[0],reverse=True)
    top=[hit for _,hit in ranked[:top_k]]
    print(f"  [Rerank] Top {len(top)} chunks selected.")
    return top


def retrieve(query:str,collection,all_chunks:list,top_k:int=5)->list:
    print(f"\n[Retriever] Query: {query}")
    
    hyde_vector = hyde_embed(query)
    hits        = hybrid_search(query, hyde_vector, collection, all_chunks)
    top_chunks  = rerank(query, hits, top_k=top_k)
    return top_chunks