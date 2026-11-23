import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  MiniMap,
} from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import Header, { APP_NAME } from './shell/Header.jsx'
import HomePage from './shell/HomePage.jsx'
import ProjectMissing from './shell/ProjectMissing.jsx'
import { useHomepage } from './shell/useHomepage.js'
import { ROUTE } from './shell/routes.js'
import { OPENING, useStoredProject } from './shell/useStoredProject.js'
import { describeImportStatus } from './flow/importFlow.js'
import { OPEN_OUTCOME } from './flow/projectLibrary.js'
import { asksBeforeLeaving, storeProblemsOf } from './flow/storeStatus.js'
import Announcer from './shell/Announcer.jsx'
import ImportConfirm from './shell/ImportConfirm.jsx'
import DevCommandTrigger from './shell/DevCommandTrigger.jsx'
import ImportStatus from './shell/ImportStatus.jsx'
import HelpMenu from './shell/HelpMenu.jsx'
import MetricsBar from './shell/MetricsBar.jsx'
import ProblemsPanel from './shell/ProblemsPanel.jsx'
import { isValidConnection } from './flow/connections.js'
import { STEP_TYPE } from './flow/step.js'
import StepCard from './shell/StepCard.jsx'
import ConfirmDialog from './shell/ConfirmDialog.jsx'
import StoreNotice from './shell/StoreNotice.jsx'
import StoreProblems from './shell/StoreProblems.jsx'
import { StoreProvider, useStore } from './shell/StoreProvider.jsx'
import { themeStyle, tokens } from './shell/tokens.js'
import { useAnnouncer } from './shell/useAnnouncer.js'
import { useLeaveGuard } from './shell/useLeaveGuard.js'
import { useProject } from './shell/useProject.js'
import { useRoute } from './shell/useRoute.js'

// Module-level so React Flow sees one stable object across renders.
const nodeTypes = { [STEP_TYPE]: StepCard }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: tokens.arrowhead } }
const DELETE_KEYS = ['Delete', 'Backspace']
const themeProperties = themeStyle()
const EDIT_PROBLEMS_LABEL = 'Edit problems'
const EMPTY_MAP_MESSAGE = 'This map has no steps yet. Import a project file to fill it.'

function Shell({ routeName, initial }) {
  const { message, announce } = useAnnouncer()
  const { saveProject, storeStatus } = useStore()
  const openId = initial.project.id
  const storeProblems = storeProblemsOf(storeStatus, openId)
  // Leaving inside the app asks first while the open project's last change is not stored.
  const shouldAsk = useCallback(() => asksBeforeLeaving(storeStatus, openId), [storeStatus, openId])
  const leaveGuard = useLeaveGuard({ shouldAsk })
  const importButtonRef = useRef(null)
  const canvasElementRef = useRef(null)
  // The page's heading takes focus when the project opens, as on every route.
  const headingRef = useRef(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  const {
    projectName,
    steps,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onBeforeDelete,
    applyEdit,
    editRejection,
    editPanelRef,
    dismissEditProblems,
    exportProject,
    importState,
    importFile,
    confirmImport,
    cancelImport,
    dismissImportError,
  } = useProject({ initial, saveProject, announce, importButtonRef, canvasElementRef })
  const handleExport = useCallback(
    async () => announce(`Exported ${await exportProject()}`),
    [announce, exportProject],
  )

  const isValidForEdges = useCallback((connection) => isValidConnection(edges)(connection), [edges])

  return (
    <div className="shell" style={themeProperties} data-route={routeName}>
      <Header
        projectName={projectName}
        onExport={handleExport}
        onImportFile={importFile}
        importButtonRef={importButtonRef}
        onHomeClick={leaveGuard.guardLink}
      />
      <StoreNotice openId={openId} className="shell__notice" />
      <ImportStatus
        state={importState}
        describe={describeImportStatus}
        onDismiss={dismissImportError}
      />
      <StoreProblems problems={storeProblems} />
      {editRejection && (
        <ProblemsPanel
          ref={editPanelRef}
          view={editRejection}
          label={EDIT_PROBLEMS_LABEL}
          onDismiss={dismissEditProblems}
          className="edit-status"
        />
      )}
      <Announcer message={message} />
      <ImportConfirm state={importState} onConfirm={confirmImport} onCancel={cancelImport} />
      {leaveGuard.pendingTarget !== null && (
        <ConfirmDialog
          message="Leave without saving?"
          confirmText="Leave"
          cancelText="Stay"
          onConfirm={leaveGuard.leave}
          onCancel={leaveGuard.stay}
        >
          <p>
            Your last change to {projectName} is not saved in this browser. Export first to keep it.
          </p>
        </ConfirmDialog>
      )}
      {import.meta.env.DEV && <DevCommandTrigger onCommands={applyEdit} />}
      <HelpMenu />
      <MetricsBar steps={steps} />
      <main ref={canvasElementRef} tabIndex={-1} aria-label="Value stream map" className="canvas">
        <h1 ref={headingRef} tabIndex={-1} className="visually-hidden">
          ai-enabler value stream map
        </h1>
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
          onBeforeDelete={onBeforeDelete}
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

// A status line with aria-busy while a page waits for the store.
function Loading({ text, routeName }) {
  useEffect(() => {
    document.title = APP_NAME
  }, [])
  return (
    <div className="page" style={themeProperties} data-route={routeName}>
      <main className="page__body" aria-busy="true">
        <p role="status">{text}</p>
      </main>
    </div>
  )
}

// The page at a project link, keyed by id by its caller, so moving between projects never reuses
// a canvas.
function ProjectRoute({ id }) {
  const outcome = useStoredProject(id)
  if (outcome.type === OPENING.type)
    return <Loading text="Opening project…" routeName={ROUTE.PROJECT} />
  if (outcome.type !== OPEN_OUTCOME.found) return <ProjectMissing outcome={outcome} />
  return (
    <ReactFlowProvider>
      <Shell routeName={ROUTE.PROJECT} initial={outcome.project} />
    </ReactFlowProvider>
  )
}

function HomeRoute() {
  const { message, announce } = useAnnouncer()
  const home = useHomepage({ announce })
  return (
    <HomePage
      state={home.state}
      message={message}
      onSortChange={home.setSort}
      onOpenCreate={home.openCreate}
      onOpenRename={home.openRename}
      onOpenDelete={home.openDelete}
      onCancelDialog={home.cancelDialog}
      onCreate={home.create}
      onRename={home.rename}
      onDuplicate={home.duplicate}
      onConfirmDelete={home.confirmDelete}
      onExport={home.exportProject}
      onImportNew={home.importNew}
      onDismissImport={home.dismissImport}
      replace={home.replace}
      isStoreReady={home.isStoreReady}
    />
  )
}

export default function App() {
  const route = useRoute()
  return (
    <StoreProvider>
      {route.name === ROUTE.PROJECT ? <ProjectRoute key={route.id} id={route.id} /> : <HomeRoute />}
    </StoreProvider>
  )
}
