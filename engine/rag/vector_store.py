import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = os.getenv("PINECONE_INDEX", "codeatlas")

class PineconeWrapper:
    def __init__(self, index, namespace):
        self.index = index
        self.namespace = namespace

def get_or_create_collection(project_id: str):
    """
    In Pinecone, we use a single Index and separate projects by 'namespace'.
    """
    index = pc.Index(INDEX_NAME)
    return PineconeWrapper(index, namespace=project_id)

def add_chunks(wrapper: PineconeWrapper, chunks: list, embeddings: list):
    vectors = []
    for i, c in enumerate(chunks):
        metadata = {
            "file":       c["file"],
            "name":       c["name"],
            "type":       c["type"],
            "start_line": c["start_line"],
            "end_line":   c["end_line"],
            "language":   c["language"],
            "project_id": c["project_id"],
            "text":       c["text"]  # Store text inside metadata for retrieval
        }
        vectors.append((c["id"], embeddings[i], metadata))
    
    # Pinecone recommends upserting in batches of 100
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        wrapper.index.upsert(
            vectors=vectors[i:i+batch_size],
            namespace=wrapper.namespace
        )

def search_chunks(wrapper: PineconeWrapper, query_embeddings: list, top_k: int = 20) -> list:
    response = wrapper.index.query(
        namespace=wrapper.namespace,
        vector=query_embeddings,
        top_k=top_k,
        include_metadata=True
    )
    
    hits = []
    for match in response.matches:
        hits.append({
            "text":     match.metadata.get("text", ""),
            "metadata": match.metadata,
            # Pinecone cosine returns a similarity score (higher is better), 
            # we keep the key 'distance' to match the old ChromaDB signature expectations.
            "distance": match.score 
        })
    return hits

def delete_collection(project_id: str):
    """
    Deletes an entire namespace from the Pinecone index.
    """
    index = pc.Index(INDEX_NAME)
    try:
        index.delete(delete_all=True, namespace=project_id)
        print(f"Deleted vector namespace {project_id} from Pinecone.")
    except Exception as e:
        print(f"Failed to delete vector namespace {project_id}: {e}")