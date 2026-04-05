import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = 'http://localhost:3000'

function StatusBadge({ status }) {
  const map = {
    ready:      { label: 'Ready',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
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
  const navigate = useNavigate()

  const load = async () => {
    try { const r = await axios.get(`${API}/api/projects`); setProjects(r.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  return (
    <div className="min-h-screen bg-black text-white">

      <nav className="flex justify-between items-center px-10 py-5 border-b border-zinc-800">
        <span onClick={() => navigate('/')} className="text-xl font-black tracking-tight gradient-text cursor-pointer">⬡ CodeAtlas</span>
        <button onClick={() => navigate('/')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all">
          + New Project
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-4xl font-black mb-2 tracking-tight">My Projects</h1>
          <p className="text-zinc-500 text-sm">{projects.length} repositor{projects.length === 1 ? 'y' : 'ies'} analysed</p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />)}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-5">🗂️</div>
            <h3 className="text-2xl font-bold mb-3">No projects yet</h3>
            <p className="text-zinc-500 mb-8">Upload a ZIP to analyse your first repository</p>
            <button onClick={() => navigate('/')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-all">
              Upload your first repo →
            </button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 fade-in">
            {projects.map(p => (
              <div key={p._id}
                onClick={() => p.status === 'ready' && navigate(`/project/${p.project_id}`)}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-7 flex flex-col gap-5 transition-all duration-200
                  ${p.status === 'ready'
                    ? 'cursor-pointer hover:border-emerald-500 hover:bg-zinc-800/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                    : 'cursor-default'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Repository</p>
                    <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-black text-emerald-400">{p.file_count}</p>
                    <p className="text-xs text-zinc-500">files</p>
                  </div>
                  <div className="w-px bg-zinc-800" />
                  <div>
                    <p className="text-2xl font-black text-white">{timeAgo(p.createdAt)}</p>
                    <p className="text-xs text-zinc-500">uploaded</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                  <span className="font-mono text-[11px] text-zinc-600">{p.project_id.slice(0, 8)}...</span>
                  {p.status === 'ready'      && <span className="text-sm text-emerald-400 font-semibold">Open →</span>}
                  {p.status === 'processing' && <span className="text-xs text-zinc-500">Analysing...</span>}
                  {p.status === 'error'      && <span className="text-xs text-red-500">Failed</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
