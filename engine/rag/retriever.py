import os
import numpy as np 
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



def dense_search(query:str,hyde_vector:list,collection,top_k:int=20)->list:
    print("performing dense vector search via pinecone")
    return search_chunks(collection,hyde_vector,top_k=top_k)



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


def retrieve(query:str,collection,top_k:int=5)->list:
    print(f"\n[Retriever] Query: {query}")
    
    hyde_vector = hyde_embed(query)
    hits        = dense_search(query, hyde_vector, collection)
    top_chunks  = rerank(query, hits, top_k=top_k)
    return top_chunks