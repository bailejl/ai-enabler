import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState } from 'react'
import { initialEdges, initialNodes } from './flow/initialFlow.js'
import { createStarterProject } from './flow/project.js'
import Header from './shell/Header.jsx'
import HelpMenu from './shell/HelpMenu.jsx'
import { tokens, toCssCustomProperties } from './shell/tokens.js'

const themeProperties = toCssCustomProperties(tokens)

export default function App() {
  const [project] = useState(createStarterProject)
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges],
  )

  return (
    <div className="shell" style={themeProperties}>
      <Header projectName={project.name} />
      <HelpMenu />
      <main aria-label="Value stream map" className="canvas">
        <h1 className="visually-hidden">ai-enabler value stream map</h1>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </main>
    </div>
  )
}
