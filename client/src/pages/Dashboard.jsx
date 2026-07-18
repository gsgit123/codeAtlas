import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { UserButton, useAuth } from '@clerk/clerk-react'
import io from 'socket.io-client'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function StatusBadge({ status }) {
  const map = {
    ready:      { label: 'Ready',      cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    processing: { label: 'Processing', cls: 'bg-amber-500/10  text-amber-400  border-amber-500/30'  },
    error:      { label: 'Error',      cls: 'bg-red-500/10    text-red-400    border-red-500/30'    },
  }
  const cfg = map[status] || map.processing
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {status === 'processing' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />}
      {cfg.label}
    </span>
  )
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d)
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (h < 1) return `${m}m ago`
  if (day < 1) return `${h}h ago`
  return `${day}d ago`
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [projectToDelete, setProjectToDelete] = useState(null)
  const navigate = useNavigate()

  const { userId } = useAuth()

  const load = async () => {
    try { const r = await axios.get(`${API}/api/projects`); setProjects(r.data) }
    finally { setLoading(false) }
  }

  const promptDelete = (p, e) => {
    e.stopPropagation();
    setProjectToDelete(p);
  }

  const executeDelete = async () => {
    if (!projectToDelete) return;
    const id = projectToDelete.project_id;
    setProjectToDelete(null);
    setDeletingId(id);
    try {
      await axios.delete(`${API}/api/projects/${id}`);
      setProjects(prev => prev.filter(p => p.project_id !== id));
    } catch (err) {
      alert("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  }

  // Load initially
  useEffect(() => { load() }, [])

  // Socket.io connection for real-time progress updates
  useEffect(() => {
    if (!userId) return;
    
    const socket = io(API);
    socket.on('connect', () => {
        socket.emit('subscribe', userId);
    });

    socket.on('project_update', (updatedProject) => {
        setProjects(prev => prev.map(p => p.project_id === updatedProject.project_id ? updatedProject : p));
    });

    return () => socket.disconnect();
  }, [userId])

  return (
    <div className="min-h-screen bg-neutral-950 text-white">

      <nav className="flex justify-between items-center px-10 py-5 border-b border-neutral-800">
        <span onClick={() => navigate('/')} className="text-xl font-black tracking-tight gradient-text cursor-pointer">⬡ CodeAtlas</span>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')}
            className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all">
            + New Project
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-4xl font-black mb-2 tracking-tight">My Projects</h1>
          <p className="text-neutral-500 text-sm">{projects.length} repositor{projects.length === 1 ? 'y' : 'ies'} analysed</p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse" />)}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-5">🗂️</div>
            <h3 className="text-2xl font-bold mb-3">No projects yet</h3>
            <p className="text-neutral-500 mb-8">Upload a ZIP to analyse your first repository</p>
            <button onClick={() => navigate('/')}
              className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl transition-all">
              Upload your first repo →
            </button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 fade-in">
            {projects.map(p => (
              <div key={p._id}
                onClick={() => p.status === 'ready' && navigate(`/project/${p.project_id}`)}
                className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-7 flex flex-col gap-5 transition-all duration-200
                  ${p.status === 'ready'
                    ? 'cursor-pointer hover:border-orange-500 hover:bg-neutral-800/60 hover:shadow-[0_0_30px_rgba(249,115,22,0.1)]'
                    : 'cursor-default'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-1">Repository</p>
                    <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  </div>
                  <div className="flex gap-2 items-center">
                    <StatusBadge status={p.status} />
                    <button 
                      onClick={(e) => promptDelete(p, e)}
                      disabled={deletingId === p.project_id}
                      className="p-1.5 rounded bg-neutral-800/50 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Project"
                    >
                      {deletingId === p.project_id ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-500 border-t-neutral-300 animate-spin" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {p.summary && (
                  <p className="text-xs text-neutral-400 leading-relaxed font-medium bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                    ✨ {p.summary}
                  </p>
                )}

                <div className="flex gap-6 mt-auto">
                  <div>
                    <p className="text-2xl font-black text-orange-400">{p.file_count}</p>
                    <p className="text-xs text-neutral-500">files</p>
                  </div>
                  <div className="w-px bg-neutral-800" />
                  <div>
                    <p className="text-2xl font-black text-white">{timeAgo(p.createdAt)}</p>
                    <p className="text-xs text-neutral-500">uploaded</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-neutral-800">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[11px] text-neutral-600">{p.project_id.slice(0, 8)}...</span>
                    {p.status === 'ready'      && <span className="text-sm text-orange-400 font-semibold">Open →</span>}
                    {p.status === 'processing' && <span className="text-xs text-amber-400">{p.progress_text || 'Analysing...'}</span>}
                    {p.status === 'error'      && <span className="text-xs text-red-500">{p.progress_text || 'Failed'}</span>}
                  </div>
                  {p.status === 'processing' && (
                    <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mt-1 relative">
                      <div 
                        className="absolute h-full bg-orange-500 shadow-[0_0_10px_#f97316] transition-all duration-700 ease-out" 
                        style={{ width: `${p.progress_percent || 5}%` }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm px-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-7 max-w-sm w-full shadow-2xl fade-in">
            <h3 className="text-xl font-bold text-white mb-2">Delete Project?</h3>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-orange-400 font-semibold">{projectToDelete.name}</span>? 
              This will permanently wipe all graph nodes and vector embeddings. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
