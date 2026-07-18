# CodeAtlas

CodeAtlas is an advanced codebase intelligence and visualization platform designed to help developers instantly understand, navigate, and query complex software architectures. By combining Abstract Syntax Tree (AST) parsing with Graph Databases and Vector-based Retrieval-Augmented Generation (RAG), CodeAtlas acts as an automated system architect and senior developer assistant.

## System Architecture

CodeAtlas operates on a decoupled, microservice-based architecture to ensure scalability, security, and performance.

### 1. Frontend (React / Vite)
The user interface is built with React and styled using standard CSS (with a custom design system). It provides the following core views:
* **Landing Page:** Allows users to ingest codebases via a ZIP upload or by providing a public GitHub repository URL.
* **Dashboard:** Displays previously parsed repositories with metadata (file count, upload time).
* **Project Dashboard:** A dual-pane interface containing:
  * An interactive React Flow canvas that visually maps out file dependencies, imports, and architectural nodes.
  * A persistent AI chat panel for querying the codebase in natural language.

### 2. API Gateway (Node.js / Express)
The Node.js server acts as the central orchestrator and security gateway.
* **Responsibilities:** 
  * Handles user authentication and session management via Clerk.
  * Manages MongoDB operations to store project metadata, upload status, and chat history.
  * Proxies heavy computational requests (like parsing triggers and RAG queries) to the Python Engine.
  * Maintains real-time communication with the frontend via Socket.io to broadcast asynchronous progress updates (e.g., parsing progress).

### 3. AI Processing Engine (Python / FastAPI / Celery)
The heavy lifting is strictly isolated to the Python backend to utilize advanced data science and machine learning libraries.
* **Celery Worker Pipeline:** When a repository is uploaded or cloned, the task is handed off to a Redis-backed Celery queue. The worker executes a multi-stage pipeline:
  1. **Source Code Extraction:** Clones the GitHub repository or unzips the uploaded files.
  2. **AST Parsing:** Uses Tree-Sitter to perform deep syntactic analysis of the code (currently supporting JavaScript, TypeScript, and Python). It extracts functions, classes, dependencies, and internal logic without relying on regex.
  3. **Graph Construction:** Maps the parsed relationships (e.g., "File A imports Function B") and uploads them to a Neo4j Graph Database.
  4. **Vector Embedding:** Chunks the source code and documentation, embeds the chunks into dense vectors, and stores them in Pinecone for semantic retrieval.
* **Query Router:** When a user asks a question, the FastAPI server routes the query to determine the best retrieval strategy.
  * **Behavioral Queries:** Uses standard semantic search against Pinecone (e.g., "How does user authentication work?").
  * **Structural / Impact Queries:** Uses Cypher queries against Neo4j to trace execution paths or determine the blast radius of a change (e.g., "What breaks if I change the JWT middleware?").
* **LLM Synthesis:** The retrieved contexts (both vector and graph data) are synthesized and sent to a Large Language Model (Groq) to generate accurate, heavily cited technical answers.
* **Semantic Caching:** Implements Redis-based cosine-similarity caching. If a user asks a question mathematically similar to a previously answered question, the engine bypasses the LLM and returns the cached answer instantly, reducing latency and cost.

## Core Workflows

### Codebase Ingestion Flow
1. The user provides a GitHub URL.
2. The Node.js server generates a unique project ID, saves a placeholder to MongoDB, and triggers the FastAPI `/parse-github` endpoint.
3. The Celery worker picks up the task, performs a shallow `git clone` to disk, and runs the AST parsing pipeline.
4. As the pipeline progresses through parsing, graph building, and vector embedding, the worker sends HTTP PATCH requests back to the Node.js server.
5. The Node.js server broadcasts these updates to the client via WebSockets for real-time progress bars.
6. Upon completion, the temporary repository files are securely deleted from the host disk.

### Hybrid RAG Query Flow
1. The user submits a natural language question via the Chat Panel.
2. The Node.js server verifies ownership via Clerk and proxies the request to the Python Engine.
3. The Engine checks the Redis semantic cache. If a match is found, it returns immediately.
4. If no cache match is found, the query router classifies the intent.
5. The Engine retrieves relevant code snippets from Pinecone and structural relationships from Neo4j.
6. The data is formatted into a strict prompt enforcing citations.
7. The LLM generates a response detailing the logic and explicitly listing the files and functions referenced.
8. The frontend parses this response, rendering clickable citations that highlight the corresponding nodes on the React Flow graph.

## Technologies Used
* **Frontend:** React, Vite, React Flow, Axios, Clerk
* **Backend:** Node.js, Express, Socket.io, Mongoose
* **Engine:** Python, FastAPI, Celery, Tree-Sitter
* **Databases:** MongoDB (Metadata), Neo4j (Graph), Pinecone (Vector), Redis (Queue/Cache)
* **AI/LLM:** Groq (Llama Models)
