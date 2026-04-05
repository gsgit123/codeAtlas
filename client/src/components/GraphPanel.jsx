import { useCallback, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'

function CodeNode({ data, selected }) {
  const isHub       = data.is_hub
  const isCycle     = data.has_cycle
  const isHighlight = data.highlighted

  const borderColor = isHighlight ? '#10b981' : isHub ? '#f59e0b' : isCycle ? '#ef4444' : '#3f3f46'
  const glowColor   = isHighlight ? 'rgba(16,185,129,0.25)' : isHub ? 'rgba(245,158,11,0.2)' : isCycle ? 'rgba(239,68,68,0.2)' : 'transparent'
  const dotColor    = isHighlight ? '#34d399' : isHub ? '#f59e0b' : isCycle ? '#ef4444' : '#71717a'

  return (
    <div style={{
      background: '#09090b',
      border: `1.5px solid ${borderColor}`,
      borderRadius: '10px',
      padding: '10px 14px',
      minWidth: '140px',
      maxWidth: '180px',
      boxShadow: selected
        ? `0 0 0 2px ${borderColor}, 0 0 20px ${glowColor}`
        : `0 0 12px ${glowColor}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
      position: 'relative'
    }}>
      <Handle type="target" position={Position.Left}  style={{ background: borderColor, border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: borderColor, border: 'none', width: 8, height: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: '9px', color: '#71717a', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {data.language?.split('/')[0] || 'file'}
        </span>
        {isHub   && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#f59e0b', fontWeight: '600' }}>HUB</span>}
        {isCycle && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#ef4444', fontWeight: '600' }}>CYCLE</span>}
      </div>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.label}
      </div>
      <div style={{ marginTop: '6px', fontSize: '10px', color: '#52525b' }}>
        {data.function_count > 0 && `${data.function_count} fn`}
        {data.in_degree > 0 && ` · ${data.in_degree} imports`}
      </div>
    </div>
  )
}

const nodeTypes = { default: CodeNode }

const edgeDefaults = {
  style:     { stroke: '#3f3f46', strokeWidth: 1.5 },
  markerEnd: { type: 'arrowclosed', color: '#3f3f46', width: 16, height: 16 },
  animated:  false,
}

export default function GraphPanel({ nodes: rawNodes, edges: rawEdges, highlightIds, onNodeClick }) {
  const enriched = rawNodes.map(n => ({
    ...n,
    data: { ...n.data, highlighted: highlightIds.includes(n.id) }
  }))

  const styledEdges = rawEdges.map(e => ({
    ...e,
    ...edgeDefaults,
    animated: highlightIds.includes(e.source) || highlightIds.includes(e.target),
    style: {
      ...edgeDefaults.style,
      stroke: (highlightIds.includes(e.source) || highlightIds.includes(e.target)) ? '#10b981' : '#3f3f46'
    }
  }))

  const [nodes, setNodes, onNodesChange] = useNodesState(enriched)
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges)

  useEffect(() => {
    setNodes(rawNodes.map(n => ({
      ...n,
      data: { ...n.data, highlighted: highlightIds.includes(n.id) }
    })))
  }, [highlightIds, rawNodes])

  useEffect(() => {
    setEdges(rawEdges.map(e => ({
      ...e,
      ...edgeDefaults,
      animated: highlightIds.includes(e.source) || highlightIds.includes(e.target),
      style: {
        ...edgeDefaults.style,
        stroke: (highlightIds.includes(e.source) || highlightIds.includes(e.target)) ? '#10b981' : '#3f3f46'
      }
    })))
  }, [highlightIds, rawEdges])

  const onNodeClickHandler = useCallback((_, node) => {
    onNodeClick(node.data)
  }, [onNodeClick])

  return (
    <div style={{ width: '100%', height: '100%', background: '#09090b' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#18181b" gap={24} size={1} />
        <Controls style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }} />
        <MiniMap
          style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
          nodeColor={(n) => n.data?.is_hub ? '#f59e0b' : n.data?.has_cycle ? '#ef4444' : '#3f3f46'}
          maskColor="rgba(9,9,11,0.85)"
        />
      </ReactFlow>
    </div>
  )
}
