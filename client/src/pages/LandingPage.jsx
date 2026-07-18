import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function LandingPage() {
  const [file, setFile]           = useState(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [importMode, setImportMode] = useState('zip') // 'zip' or 'github'

  const [status, setStatus]       = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [dragOver, setDragOver]   = useState(false)
  const fileInputRef              = useRef(null)
  const navigate                  = useNavigate()
  const { getToken }              = useAuth()

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
        const token = await getToken();
        const res = await axios.get(`${API}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = res.data
        if (data.status === 'ready') {
          clearInterval(iv); setStatus('done')
          setStatusMsg('Analysis complete! Redirecting...')
          setTimeout(() => navigate(`/project/${projectId}`), 1200)
        } else if (data.status === 'error') {
          clearInterval(iv); setStatus('error')
          setStatusMsg(data.progress_text || 'Processing failed. Please try again.')
        } else if (data.status === 'processing' && data.progress_text) {
          setStatusMsg(data.progress_text)
          if (data.progress_percent !== undefined) setProgressPercent(data.progress_percent)
        }
      } catch { clearInterval(iv); setStatus('error'); setStatusMsg('Server error.') }
    }, 1000)
  }

  const handleUpload = async () => {
    if (!file && importMode === 'zip') return
    if (!githubUrl && importMode === 'github') return
    
    setStatus('uploading'); 
    setStatusMsg(importMode === 'zip' ? 'Uploading repository...' : 'Triggering GitHub clone...')
    
    try {
      const token = await getToken();
      let res;

      if (importMode === 'zip') {
        const formData = new FormData()
        formData.append('repo', file)
        res = await axios.post(`${API}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
        })
      } else {
        res = await axios.post(`${API}/api/github-import`, { repo_url: githubUrl }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      setStatus('processing')
      setStatusMsg('Parsing code, building graph, embedding vectors...')
      pollStatus(res.data.project_id)
    } catch {
      setStatus('error'); setStatusMsg('Import failed. Are both servers running?')
    }
  }

  const statusColor = {
    uploading:  'text-orange-400',
    processing: 'text-amber-400',
    done:       'text-orange-400',
    error:      'text-red-400'
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-6 py-20">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-10 py-5 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md z-50">
        <span className="text-xl font-black tracking-tight gradient-text">CodeAtlas</span>
        <div className="flex items-center gap-4">
          <SignedIn>
            <button onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-neutral-400 border border-neutral-700 px-4 py-2 rounded-lg hover:border-orange-500 hover:text-white transition-all">
              My Projects →
            </button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center max-w-2xl mb-14 fade-in">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 text-xs text-orange-300 mb-7 font-medium">
          ✦ AI-Powered Codebase Intelligence
        </div>
        <h1 className="text-6xl font-black leading-[1.08] tracking-tight mb-5">
          Understand any codebase{' '}
          <span className="gradient-text">instantly</span>
        </h1>
        <p className="text-lg text-neutral-400 leading-relaxed max-w-lg mx-auto">
          Upload your repository as a ZIP or import from GitHub. CodeAtlas parses every file,
          builds a dependency graph, and answers plain-English questions about your code.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="w-full max-w-lg fade-in">
        <SignedIn>
          
          <div className="flex gap-2 mb-4 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
            <button 
              onClick={() => setImportMode('zip')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${importMode === 'zip' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Upload ZIP
            </button>
            <button 
              onClick={() => setImportMode('github')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${importMode === 'github' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              GitHub URL
            </button>
          </div>

          {importMode === 'zip' ? (
            <div
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300
                ${dragOver
                  ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_40px_rgba(249,115,22,0.15)]'
                  : 'border-neutral-700 bg-neutral-900 hover:border-orange-500 hover:bg-orange-500/5'}`}
            >
              <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div>
                  <div className="text-4xl mb-3">📦</div>
                  <p className="font-semibold text-base mb-1">{file.name}</p>
                  <p className="text-neutral-500 text-sm mb-4">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="text-xs border border-neutral-700 text-neutral-400 px-3 py-1.5 rounded-md hover:border-neutral-500">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-4">⬆️</div>
                  <p className="font-semibold text-base mb-2">Drop your repository ZIP here</p>
                  <p className="text-neutral-500 text-sm">or click to browse files</p>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-2xl p-10 text-center bg-neutral-900">
              <div className="text-5xl mb-4">🐙</div>
              <p className="font-semibold text-base mb-4">Import a public repository</p>
              <input 
                type="text" 
                placeholder="https://github.com/facebook/react"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-orange-500 text-white text-sm placeholder-neutral-600 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
          )}

          {((importMode === 'zip' && file) || (importMode === 'github' && githubUrl)) && status === 'idle' && (
            <button onClick={handleUpload}
              className="w-full mt-4 py-4 bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-semibold rounded-xl transition-all text-base">
              Analyse Repository →
            </button>
          )}

          {status !== 'idle' && (
            <div className="mt-5 p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="flex items-center gap-3">
                {(status === 'uploading' || status === 'processing') && (
                  <div className={`w-2 h-2 rounded-full pulse-dot ${status === 'uploading' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                )}
                {status === 'done'  && <span>✅</span>}
                {status === 'error' && <span>❌</span>}
                <span className={`font-semibold text-sm ${statusColor[status]}`}>{statusMsg}</span>
              </div>
              {status === 'processing' && (
                <>
                  <p className="text-neutral-600 text-xs mt-3 mb-2 leading-relaxed">
                    This may take 20–60s depending on codebase size.
                  </p>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative mt-4">
                    <div 
                      className="absolute h-full bg-orange-500 shadow-[0_0_10px_#f97316] transition-all duration-700 ease-out" 
                      style={{ width: `${progressPercent || 5}%` }} 
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </SignedIn>

        <SignedOut>
          <div className="border border-neutral-800 rounded-2xl p-10 text-center bg-neutral-900/50">
            <h3 className="text-xl font-bold mb-3">Sign in to start analysing</h3>
            <p className="text-neutral-500 mb-6 text-sm">Create a free account to upload your repositories and access the AI chat.</p>
            <SignInButton mode="modal">
              <button className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl transition-all w-full">
                Get Started
              </button>
            </SignInButton>
          </div>
        </SignedOut>
      </div>

      {/* Pills */}
      <div className="flex gap-3 flex-wrap justify-center mt-14 fade-in">
        {['⚡ AST Parsing', '🕸 Dependency Graph', '🧠 Vector Embeddings', '🔍 Hybrid Search', '🤖 AI Answers'].map(f => (
          <span key={f} className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-xs text-neutral-400">{f}</span>
        ))}
      </div>
    </div>
  )
}