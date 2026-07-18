import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const ROUTE_COLORS = {
  behavioral: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  impact: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  structural: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  trace: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
}

export default function ChatPanel({ projectId, initialMessages = [], isOpen = true, onClose, onHighlight, onFileClick, prefillQuestion, onPrefillConsumed }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (prefillQuestion) {
      setInput(prefillQuestion)
      inputRef.current?.focus()
      onPrefillConsumed()
    }
  }, [prefillQuestion])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const q = input.trim()
    if (!q || loading) return
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)
    try {
      const res = await axios.post(`${API}/api/query`, { project_id: projectId, question: q })
      const { answer, files_used, nodes_used, route } = res.data
      if (files_used?.length > 0) onHighlight(files_used)
      setMessages(prev => [...prev, { role: 'assistant', text: answer, route, files_used, nodes_used }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', text: '❌ Failed to get answer. Check all servers are running.',
        route: null, files_used: [], nodes_used: []
      }])
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div
      className={`bg-neutral-900 flex flex-col overflow-hidden shrink-0 h-full transition-all duration-300 ease-in-out border-neutral-800 ${isOpen ? 'w-96 opacity-100 border-l' : 'w-0 opacity-0 border-l-0'
        }`}
    >
      <div className="w-96 flex flex-col h-full shrink-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">🤖 AI Chat</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Ask anything about this codebase</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors p-1"
            title="Close Chat"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center text-center py-10">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-neutral-400 text-sm font-medium mb-4">Ask about your code</p>
              <div className="flex flex-col gap-2 w-full">
                {['How does file upload work?', 'What are the most critical files?', 'What breaks if I change App.jsx?'].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-xs text-left text-neutral-400 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-orange-500 rounded-lg px-3 py-2 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

              {msg.role === 'user' && (
                <div className="bg-orange-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%]">
                  {msg.text}
                </div>
              )}

              {msg.role === 'assistant' && (
                <div className="max-w-full">
                  {msg.route && (() => {
                    const c = ROUTE_COLORS[msg.route] || ROUTE_COLORS.behavioral
                    return (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border mb-2 ${c.bg} ${c.text} ${c.border}`}>
                        {msg.route}
                      </span>
                    )
                  })()}

                  <div className="bg-neutral-800 border border-neutral-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-neutral-200">
                    <ReactMarkdown
                      components={{
                        code: ({ children }) => (
                          <code className="bg-black text-orange-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-black border border-neutral-700 rounded-lg p-3 overflow-x-auto text-xs">{children}</pre>
                        ),
                      }}
                    >
                      {msg.text.replace(/FILES_USED:.*$/m, '').replace(/NODES_USED:.*$/m, '').trim()}
                    </ReactMarkdown>
                  </div>

                  {msg.nodes_used?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...new Set(msg.nodes_used)].map(n => (
                        <span key={n} className="text-[10px] font-mono bg-neutral-800 border border-neutral-700 text-neutral-400 px-2 py-1 rounded-md">{n}</span>
                      ))}
                    </div>
                  )}

                  {msg.files_used?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[...new Set(msg.files_used)].map(f => (
                        <button
                          key={f}
                          onClick={() => onFileClick(f)}
                          className="cursor-pointer text-[10px] bg-orange-500/10 hover:bg-orange-500/20 hover:scale-105 border border-orange-500/30 text-orange-400 px-2 py-1 rounded-md font-mono transition-all"
                          title="Click to view source code"
                        >
                          📄 {f.replace(/\\/g, '/').split('/').at(-1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="bg-neutral-800 border border-neutral-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-neutral-800 shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your code..."
              rows={2}
              className="flex-1 bg-neutral-800 border border-neutral-700 focus:border-orange-500 text-white text-sm placeholder-neutral-500 rounded-xl px-3 py-2.5 resize-none outline-none transition-colors"
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium text-sm self-end">
              ↑
            </button>
          </div>
          <p className="text-neutral-600 text-[10px] mt-2 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}