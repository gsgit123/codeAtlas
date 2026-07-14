import { useState, useEffect } from 'react'
import axios from 'axios'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs'

const API = 'http://localhost:3000'

export default function NodeDrawer({ node, projectId, onClose, onAskAI }) {
  if (!node) return null

  const pathParts = (node.full_path || '').replace(/\\/g, '/').split('/')
  const fileName  = pathParts.at(-1) || 'unknown'
  const folder    = pathParts.slice(-3, -1).join('/')

  const rows = [
    { label: 'Language',        value: node.language       || '—'        },
    { label: 'Functions',       value: node.function_count ?? '—'        },
    { label: 'Imported by',     value: node.in_degree      ?? 0          },
    { label: 'Load order',      value: `#${node.topo_order ?? '?'}`      },
    { label: 'Hub file',        value: node.is_hub    ? '⭐ Yes' : 'No' },
    { label: 'Circular import', value: node.has_cycle ? '⚠️ Yes' : 'No' },
  ]

  const [code, setCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);

  useEffect(() => {
    if (!node || !projectId) return;
    setLoadingCode(true);
    axios.get(`${API}/api/projects/${projectId}/file`, { params: { path: node.full_path } })
      .then(res => setCode(res.data.source_code || '// No source code found for this file.'))
      .catch(err => setCode('// Failed to load source code.'))
      .finally(() => setLoadingCode(false));
  }, [node, projectId]);

  return (
    <div className="w-[550px] border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden shrink-0">
      <div className="flex items-start justify-between p-5 border-b border-zinc-800">
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">{folder}</p>
          <h2 className="text-base font-bold text-white truncate">{fileName}</h2>
        </div>
        <button onClick={onClose}
          className="text-zinc-600 hover:text-white text-lg leading-none ml-3 mt-0.5 transition-colors">
          ✕
        </button>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="text-xs font-semibold text-zinc-200">{String(value)}</span>
          </div>
        ))}
        <div className="mt-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Full Path</p>
          <p className="text-[11px] font-mono text-zinc-500 break-all leading-relaxed bg-black rounded-lg p-3">
            {node.full_path}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Source Code</p>
          <div className="rounded-lg border border-zinc-800 bg-[#1e1e1e] overflow-hidden">
            {loadingCode ? (
              <div className="p-5 text-sm text-zinc-500 animate-pulse">Fetching source code...</div>
            ) : (
              <SyntaxHighlighter
                language={node.language?.toLowerCase() === 'python' ? 'python' : 'javascript'}
                style={vs2015}
                customStyle={{ margin: 0, padding: '1rem', fontSize: '13px', background: 'transparent' }}
                showLineNumbers={true}
              >
                {code}
              </SyntaxHighlighter>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800">
        <button onClick={() => onAskAI(`How does ${fileName} work?`)}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-semibold transition-all">
          🤖 Ask AI about this file
        </button>
      </div>
    </div>
  )
}
