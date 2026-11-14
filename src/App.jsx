import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Header from './shell/Header.jsx'
import HelpMenu from './shell/HelpMenu.jsx'
import MetricsBar from './shell/MetricsBar.jsx'
import { tokens, toCssCustomProperties } from './shell/tokens.js'
import { useProject } from './shell/useProject.js'

const themeProperties = toCssCustomProperties(tokens)
const EMPTY_MAP_MESSAGE =
  'No steps on this map. Import a project, or reload to restore the starter map.'

function Shell() {
  const { project, nodes, edges, onNodesChange, onEdgesChange, onConnect } = useProject()

  return (
    <div className="shell" style={themeProperties}>
      <Header projectName={project.name} />
      <HelpMenu />
      <MetricsBar steps={nodes.map((node) => node.data)} />
      <main aria-label="Value stream map" className="canvas">
        <h1 className="visually-hidden">ai-enabler value stream map</h1>
        <p role="status" className="canvas__empty">
          {nodes.length === 0 ? EMPTY_MAP_MESSAGE : ''}
        </p>
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

export default function App() {
  return (
    <ReactFlowProvider>
      <Shell />
    </ReactFlowProvider>
  )
}
