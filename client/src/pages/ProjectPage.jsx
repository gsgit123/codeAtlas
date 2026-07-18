import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import GraphPanel from '../components/GraphPanel.jsx'
import NodeDrawer from '../components/NodeDrawer.jsx'
import ChatPanel  from '../components/ChatPanel.jsx'
import { UserButton } from '@clerk/clerk-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ProjectPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [project, setProject]           = useState(null)
  const [graphData, setGraphData]       = useState({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightIds, setHighlightIds] = useState([])
  const [prefillQ, setPrefillQ]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [isChatOpen, setIsChatOpen]     = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const [projRes, graphRes] = await Promise.all([
          axios.get(`${API}/api/projects/${id}`),
          axios.get(`${API}/api/projects/${id}/graph`)
        ])
        setProject(projRes.data)
        setGraphData(graphRes.data)
      } catch (e) { console.error('Failed to load project', e) }
      finally { setLoading(false) }
    }
    init()
  }, [id])

  const handleFileClick = (filePath) => {
    // Pinecone returns the absolute file path, which matches n.id in the graph
    // We need to look up the node's data object for the NodeDrawer
    const nodeObj = graphData.nodes.find(n => n.id === filePath);
    
    if (nodeObj) {
      setSelectedNode(nodeObj.data);
    } else {
      // Fallback in case of path mismatches: match by trailing suffix
      const normalizedQuery = filePath.replace(/\\/g, '/');
      const fallback = graphData.nodes.find(n => n.id.replace(/\\/g, '/').endsWith(normalizedQuery));
      if (fallback) {
        setSelectedNode(fallback.data);
      } else {
        // Last resort fake object so drawer still opens
        setSelectedNode({ full_path: filePath, label: normalizedQuery.split('/').pop() });
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-400 text-sm">Loading project...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-neutral-950 text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800 shrink-0">
        <span onClick={() => navigate('/dashboard')}
          className="text-lg font-black tracking-tight gradient-text cursor-pointer">
          ⬡ CodeAtlas
        </span>
        <span className="text-neutral-700">›</span>
        <span className="text-neutral-300 font-semibold">{project?.name || id}</span>
        <div className="ml-auto flex items-center gap-4 text-xs text-neutral-500">
          <span>{graphData.nodes.length} files</span>
          <span>·</span>
          <span>{graphData.edges.length} imports</span>
          {highlightIds.length > 0 && (
            <button onClick={() => setHighlightIds([])}
              className="text-orange-400 hover:text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-md transition-colors">
              ✕ Clear highlights
            </button>
          )}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-2 ${
              isChatOpen 
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' 
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700'
            }`}
          >
            🤖 AI Chat {isChatOpen ? '· Open' : '· Closed'}
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-2" />
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative" style={{ minWidth: 0 }}>
          <GraphPanel
            nodes={graphData.nodes}
            edges={graphData.edges}
            highlightIds={highlightIds}
            onNodeClick={setSelectedNode}
          />
        </div>

        <NodeDrawer
          node={selectedNode}
          projectId={id}
          onClose={() => setSelectedNode(null)}
          onAskAI={(q) => { 
            setSelectedNode(null); 
            setPrefillQ(q);
            setIsChatOpen(true); 
          }}
        />

        <ChatPanel
          projectId={id}
          initialMessages={project?.chat_history || []}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onHighlight={setHighlightIds}
          onFileClick={handleFileClick}
          prefillQuestion={prefillQ}
          onPrefillConsumed={() => setPrefillQ(null)}
        />
      </div>

      {/* Legend */}
      <div className="shrink-0 px-6 py-3 border-t border-neutral-800 flex gap-6 text-xs text-neutral-500">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400" /> Hub file</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /> Circular import</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500" /> Highlighted by AI</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-neutral-600" /> Normal file</span>
      </div>
    </div>
  )
}
