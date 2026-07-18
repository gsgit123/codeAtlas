import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import dagre from '@dagrejs/dagre'
import 'reactflow/dist/style.css'

const NODE_W = 180
const NODE_H = 70

function applyDagreLayout(rawNodes, rawEdges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60, edgesep: 20 })

  rawNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  rawEdges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target)
    }
  })

  dagre.layout(g)

  return rawNodes.map(n => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: {
        x: pos ? pos.x - NODE_W / 2 : 0,
        y: pos ? pos.y - NODE_H / 2 : 0,
      }
    }
  })
}

function CodeNode({ data, selected }) {
  const isHub       = data.is_hub
  const isCycle     = data.has_cycle
  const isHighlight = data.highlighted

  const borderColor = isHighlight ? '#f97316' : isHub ? '#f59e0b' : isCycle ? '#ef4444' : '#3f3f46'
  const glowColor   = isHighlight ? 'rgba(249,115,22,0.25)' : isHub ? 'rgba(245,158,11,0.2)' : isCycle ? 'rgba(239,68,68,0.2)' : 'transparent'
  const dotColor    = isHighlight ? '#fb923c' : isHub ? '#f59e0b' : isCycle ? '#ef4444' : '#71717a'

  return (
    <div style={{
      background: '#09090b',
      border: `1.5px solid ${borderColor}`,
      borderRadius: '10px',
      padding: '10px 14px',
      width: `${NODE_W}px`,
      boxShadow: selected
        ? `0 0 0 2px ${borderColor}, 0 0 20px ${glowColor}`
        : `0 0 12px ${glowColor}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
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
  markerEnd: { type: 'arrowclosed', color: '#3f3f46', width: 14, height: 14 },
}

export default function GraphPanel({ nodes: rawNodes, edges: rawEdges, highlightIds, onNodeClick }) {

  // Initial layout calculation (only when raw data changes)
  const initialLayoutedNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [rawNodes, rawEdges])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges)

  // Re-sync purely coordinates when raw data changes
  useEffect(() => {
    setNodes(applyDagreLayout(rawNodes, rawEdges))
    setEdges(rawEdges.map(e => ({ ...e, ...edgeDefaults })))
  }, [rawNodes, rawEdges])

  // Update ONLY highlight state without re-running dagre layout
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, highlighted: highlightIds.includes(n.id) }
    })))
    
    setEdges(eds => eds.map(e => ({
      ...e,
      animated: highlightIds.includes(e.source) || highlightIds.includes(e.target),
      style: {
        ...edgeDefaults.style,
        stroke: (highlightIds.includes(e.source) || highlightIds.includes(e.target))
          ? '#f97316' : '#3f3f46'
      }
    })))
  }, [highlightIds])

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
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#18181b" gap={24} size={1} />
        <Controls style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }} />
        <MiniMap
          style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
          nodeColor={(n) => n.data?.highlighted ? '#f97316' : n.data?.is_hub ? '#f59e0b' : n.data?.has_cycle ? '#ef4444' : '#3f3f46'}
          maskColor="rgba(9,9,11,0.85)"
        />
      </ReactFlow>
    </div>
  )
}
