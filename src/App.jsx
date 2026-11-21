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
import { STEP_TYPE } from './flow/step.js'
import StepCard from './shell/StepCard.jsx'
import { tokens, toCssCustomProperties } from './shell/tokens.js'
import { useAnnouncer } from './shell/useAnnouncer.js'
import { useFocusAfterDelete } from './shell/useFocusAfterDelete.js'
import { useProject } from './shell/useProject.js'
import { useRoute } from './shell/useRoute.js'

// Module-level so React Flow sees one stable object across renders.
const nodeTypes = { [STEP_TYPE]: StepCard }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: tokens.arrowhead } }
const DELETE_KEYS = ['Delete', 'Backspace']
const themeProperties = toCssCustomProperties(tokens)
const EMPTY_MAP_MESSAGE =
  'No steps on this map. Import a project, or reload to restore the starter map.'

function Shell({ routeName }) {
  const { message, announce } = useAnnouncer()
  const importButtonRef = useRef(null)
  const canvasRef = useRef(null)
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
  const handleDelete = useFocusAfterDelete({ nodes, canvasRef })
  const handleExport = useCallback(
    async () => announce(`Exported ${await exportProject()}`),
    [announce, exportProject],
  )

  const isValidForEdges = useCallback((connection) => isValidConnection(edges)(connection), [edges])

  return (
    <div className="shell" style={themeProperties} data-route={routeName}>
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
          isEdited={importState.isEdited}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}
      <HelpMenu />
      <MetricsBar steps={nodes.map((node) => node.data)} />
      <main ref={canvasRef} tabIndex={-1} aria-label="Value stream map" className="canvas">
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
          onDelete={handleDelete}
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
  const route = useRoute()
  return (
    <ReactFlowProvider>
      <Shell routeName={route.name} />
    </ReactFlowProvider>
  )
}
