import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  MiniMap,
} from '@xyflow/react'
import { useCallback, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import Header from './shell/Header.jsx'
import Announcer from './shell/Announcer.jsx'
import ConfirmDialog from './shell/ConfirmDialog.jsx'
import ImportStatus from './shell/ImportStatus.jsx'
import HelpMenu from './shell/HelpMenu.jsx'
import MetricsBar from './shell/MetricsBar.jsx'
import { isValidConnection } from './flow/connections.js'
import { IMPORT_CONFIRMING } from './flow/importFlow.js'
import StepCard from './shell/StepCard.jsx'
import { tokens, toCssCustomProperties } from './shell/tokens.js'
import { useAnnouncer } from './shell/useAnnouncer.js'
import { useProject } from './shell/useProject.js'

// Module-level so React Flow sees one stable object across renders.
const nodeTypes = { step: StepCard }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: tokens.arrowhead } }
const DELETE_KEYS = ['Delete', 'Backspace']
const themeProperties = toCssCustomProperties(tokens)
const EMPTY_MAP_MESSAGE =
  'No steps on this map. Import a project, or reload to restore the starter map.'

function Shell() {
  const { message, announce } = useAnnouncer()
  const importButtonRef = useRef(null)
  const {
    project,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    exportProject,
    importState,
    importFile,
    confirmImport,
    cancelImport,
    dismissImportError,
  } = useProject({ announce, importButtonRef })
  const handleExport = useCallback(
    () => announce(`Exported ${exportProject()}`),
    [announce, exportProject],
  )

  const isValidForEdges = useCallback((connection) => isValidConnection(edges)(connection), [edges])

  return (
    <div className="shell" style={themeProperties}>
      <Header
        projectName={project.name}
        onExport={handleExport}
        onImportFile={importFile}
        importButtonRef={importButtonRef}
      />
      <ImportStatus state={importState} onDismiss={dismissImportError} />
      <Announcer message={message} />
      {importState.type === IMPORT_CONFIRMING && (
        <ConfirmDialog
          message={importState.message}
          currentName={importState.currentName}
          incomingName={importState.incomingName}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}
      <HelpMenu />
      <MetricsBar steps={nodes.map((node) => node.data)} />
      <main aria-label="Value stream map" className="canvas">
        <h1 className="visually-hidden">ai-enabler value stream map</h1>
        <p role="status" className="canvas__empty">
          {nodes.length === 0 ? EMPTY_MAP_MESSAGE : ''}
        </p>
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidForEdges}
          deleteKeyCode={DELETE_KEYS}
          defaultEdgeOptions={defaultEdgeOptions}
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
