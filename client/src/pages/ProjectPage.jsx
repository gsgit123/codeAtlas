import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import GraphPanel from '../components/GraphPanel.jsx'
import NodeDrawer from '../components/NodeDrawer.jsx'
import ChatPanel  from '../components/ChatPanel.jsx'

const API = 'http://localhost:3000'

export default function ProjectPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [project, setProject]           = useState(null)
  const [graphData, setGraphData]       = useState({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightIds, setHighlightIds] = useState([])
  const [prefillQ, setPrefillQ]         = useState(null)
  const [loading, setLoading]           = useState(true)

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

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Loading project...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-black text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 shrink-0">
        <span onClick={() => navigate('/dashboard')}
          className="text-lg font-black tracking-tight gradient-text cursor-pointer">
          ⬡ CodeAtlas
        </span>
        <span className="text-zinc-700">›</span>
        <span className="text-zinc-300 font-semibold">{project?.name || id}</span>
        <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
          <span>{graphData.nodes.length} files</span>
          <span>·</span>
          <span>{graphData.edges.length} imports</span>
          {highlightIds.length > 0 && (
            <button onClick={() => setHighlightIds([])}
              className="text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md transition-colors">
              ✕ Clear highlights
            </button>
          )}
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
          onClose={() => setSelectedNode(null)}
          onAskAI={(q) => { setSelectedNode(null); setPrefillQ(q) }}
        />

        <ChatPanel
          projectId={id}
          onHighlight={setHighlightIds}
          prefillQuestion={prefillQ}
          onPrefillConsumed={() => setPrefillQ(null)}
        />
      </div>

      {/* Legend */}
      <div className="shrink-0 px-6 py-3 border-t border-zinc-800 flex gap-6 text-xs text-zinc-500">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400" /> Hub file</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /> Circular import</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Highlighted by AI</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-zinc-600" /> Normal file</span>
      </div>
    </div>
  )
}
