import chromadb
import os

CHROMA_PATH=os.path.join(os.path.dirname(__file__),"..","chroma_store")

client=chromadb.PersistentClient(path=CHROMA_PATH)


def get_or_create_collection(project_id:str):
    safe_id=project_id.replace("-","_")
    return client.get_or_create_collection(name=f"project_{safe_id}")


def add_chunks(collection,chunks:list,embeddings:list):
    collection.add(
        ids        = [c["id"] for c in chunks],
        embeddings = embeddings,
        documents  = [c["text"] for c in chunks],
        metadatas  = [
            {
                "file":       c["file"],
                "name":       c["name"],
                "type":       c["type"],
                "start_line": c["start_line"],
                "end_line":   c["end_line"],
                "language":   c["language"],
                "project_id": c["project_id"]
            }
            for c in chunks
        ]
    )

def search_chunks(collection,query_embeddings:list,top_k:int=20)->list:
    results=collection.query(
        query_embeddings=[query_embeddings],
        n_results=top_k
    )
    hits=[]
    for i, doc in enumerate(results["documents"][0]):
        hits.append({
            "text":     doc,
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i]
        })
    return hits