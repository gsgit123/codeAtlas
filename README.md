# ⬡ CodeAtlas

CodeAtlas is an AI-powered codebase intelligence platform. It ingests your code repository, builds a deep structural understanding of it via AST parsing and dependency graphs, and allows you to ask plain-English questions about your architecture, behavior, and potential impact of changes using a RAG (Retrieval-Augmented Generation) pipeline.

## 🚀 Features
- **Instant Codebase Indexing:** Upload any `.zip` of your repository. CodeAtlas extracts, parses, and indexes it in seconds.
- **Dependency Graph Engine:** Visualizes how your code is interconnected using an interactive ReactFlow graph, automatically highlighting "Hub" files and detecting circular dependencies.
- **AI RAG Chat:** Ask questions like *"How does the authentication flow work?"* or *"What happens if I change App.jsx?"*. The AI generates an answer, cites the exact source files, and dynamically highlights them on the visual graph!
- **Multi-Language Support:** Powered by `tree-sitter`, natively supporting JavaScript, React (JSX), and Python structure parsing out of the box.

## 🏗️ Architecture Stack
CodeAtlas operates across three distinct services:

1. **Frontend (Client)**
   - Configured with React, Vite, and Tailwind CSS v4.
   - Beautiful, terminal-inspired *emerald-on-black* UI.
   - **Interactive Visualizer:** Powered by `reactflow` to dynamically layout and navigate code dependencies.

2. **Backend Gateway (Node.js)**
   - Express server handling multipart `.zip` uploads.
   - Manages state via MongoDB (tracking parsing status).
   - Serves as a secure proxy to route data and AI queries to the processing Engine.

3. **Intelligence Engine (Python/FastAPI)**
   - **Parser:** Universal AST parsing via `tree-sitter`.
   - **Graph Store:** Neo4j stores files as nodes and imports as edges, calculating graph metrics (in-degree hubs, cycles).
   - **Vector Store:** ChromaDB stores code chunks embedded via Google Gemini (`gemini-embedding-001`).
   - **Query Router:** Uses an LLM to categorize questions (Structural, Behavioral, Impact, Trace) to retrieve graph context + vector context accurately.

## 🛠️ Installation & Setup

Ensure you have **Node.js**, **Python 3.10+**, **MongoDB**, and **Neo4j** running.

### 1. Engine setup (Python)
```bash
cd engine
python -m venv venv
source venv/bin/activate  # (or venv\Scripts\activate on Windows)
pip install -r requirements.txt
```
Create `engine/.env`:
```env
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=
GEMINI_API_KEY=
```
Start the engine:
```bash
uvicorn main:app --reload
```

### 2. Server setup (Node.js)
```bash
cd server
npm install
```
Create `server/.env`:
```env
PORT=3000
MONGODB_URI=
```
Start the backend orchestrator:
```bash
node index.js
```

### 3. Client setup (React)
```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:5173` to start analyzing your code!

---

