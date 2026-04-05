import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = 'http://localhost:3000'

export default function LandingPage() {
  const [file, setFile]           = useState(null)
  const [status, setStatus]       = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const fileInputRef              = useRef(null)
  const navigate                  = useNavigate()

  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = ()  => setDragOver(false)
  const onDrop      = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.zip')) setFile(f)
    else alert('Please drop a .zip file')
  }

  const pollStatus = (projectId) => {
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/projects/${projectId}`)
        const s   = res.data.status
        if (s === 'ready') {
          clearInterval(iv); setStatus('done')
          setStatusMsg('Analysis complete! Redirecting...')
          setTimeout(() => navigate(`/project/${projectId}`), 1200)
        } else if (s === 'error') {
          clearInterval(iv); setStatus('error')
          setStatusMsg('Processing failed. Please try again.')
        }
      } catch { clearInterval(iv); setStatus('error'); setStatusMsg('Server error.') }
    }, 2000)
  }

  const handleUpload = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('repo', file)
    setStatus('uploading'); setStatusMsg('Uploading repository...')
    try {
      const res = await axios.post(`${API}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus('processing')
      setStatusMsg('Parsing code, building graph, embedding vectors...')
      pollStatus(res.data.project_id)
    } catch {
      setStatus('error'); setStatusMsg('Upload failed. Are both servers running?')
    }
  }

  const statusColor = {
    uploading:  'text-emerald-400',
    processing: 'text-amber-400',
    done:       'text-emerald-400',
    error:      'text-red-400'
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-20">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-10 py-5 border-b border-zinc-800 bg-black/80 backdrop-blur-md z-50">
        <span className="text-xl font-black tracking-tight gradient-text">⬡ CodeAtlas</span>
        <button onClick={() => navigate('/dashboard')}
          className="text-sm font-medium text-zinc-400 border border-zinc-700 px-4 py-2 rounded-lg hover:border-emerald-500 hover:text-white transition-all">
          My Projects →
        </button>
      </nav>

      {/* Hero */}
      <div className="text-center max-w-2xl mb-14 fade-in">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 text-xs text-emerald-300 mb-7 font-medium">
          ✦ AI-Powered Codebase Intelligence
        </div>
        <h1 className="text-6xl font-black leading-[1.08] tracking-tight mb-5">
          Understand any codebase{' '}
          <span className="gradient-text">instantly</span>
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed max-w-lg mx-auto">
          Upload your repository as a ZIP. CodeAtlas parses every file,
          builds a dependency graph, and answers plain-English questions about your code.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="w-full max-w-lg fade-in">
        <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300
            ${dragOver
              ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
              : 'border-zinc-700 bg-zinc-900 hover:border-emerald-500 hover:bg-emerald-500/5'}`}
        >
          <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <div>
              <div className="text-4xl mb-3">📦</div>
              <p className="font-semibold text-base mb-1">{file.name}</p>
              <p className="text-zinc-500 text-sm mb-4">{(file.size / 1024).toFixed(1)} KB</p>
              <button onClick={e => { e.stopPropagation(); setFile(null) }}
                className="text-xs border border-zinc-700 text-zinc-400 px-3 py-1.5 rounded-md hover:border-zinc-500">
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-4">⬆️</div>
              <p className="font-semibold text-base mb-2">Drop your repository ZIP here</p>
              <p className="text-zinc-500 text-sm">or click to browse files</p>
            </div>
          )}
        </div>

        {file && status === 'idle' && (
          <button onClick={handleUpload}
            className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold rounded-xl transition-all text-base">
            Analyse Repository →
          </button>
        )}

        {status !== 'idle' && (
          <div className="mt-5 p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3">
              {(status === 'uploading' || status === 'processing') && (
                <div className={`w-2 h-2 rounded-full pulse-dot ${status === 'uploading' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              )}
              {status === 'done'  && <span>✅</span>}
              {status === 'error' && <span>❌</span>}
              <span className={`font-semibold text-sm ${statusColor[status]}`}>{statusMsg}</span>
            </div>
            {status === 'processing' && (
              <p className="text-zinc-600 text-xs mt-3 leading-relaxed">
                This may take 20–60s depending on codebase size.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pills */}
      <div className="flex gap-3 flex-wrap justify-center mt-14 fade-in">
        {['⚡ AST Parsing', '🕸 Dependency Graph', '🧠 Vector Embeddings', '🔍 Hybrid Search', '🤖 AI Answers'].map(f => (
          <span key={f} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-400">{f}</span>
        ))}
      </div>
    </div>
  )
}