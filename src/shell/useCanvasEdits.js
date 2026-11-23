import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import { connectEdit, deleteEdit, moveEdit, syncCanvas } from '../flow/canvas.js'
import {
  EDIT_EVENT,
  INITIAL_EDIT_STATE,
  reduceEdit,
  runEdit,
  toEditEvent,
} from '../flow/editFlow.js'
import { report } from './diagnostics.js'
import { useFocusAfterDelete } from './useFocusAfterDelete.js'

const newId = () => crypto.randomUUID()
const NO_CANVAS = { nodes: [], edges: [] }
const isNotRemoval = (change) => change.type !== 'remove'

// Where Dismiss gives focus back: the element focused when the rejection appeared, if it is still
// in the page and is not the page itself, else the canvas.
const pickFocusTarget = (focusReturn, canvasElement) =>
  focusReturn?.isConnected && focusReturn !== document.body ? focusReturn : canvasElement

// The canvas React Flow draws, and the handlers that turn what the user does on it into edits of
// the project. Every edit goes through `applyEdit`: the project decides, and the canvas is rebuilt
// from it whether the edit was accepted or rejected. A removal never reaches the view directly:
// the delete handler returns false and the project change removes the items.
// `initialProject` is the project the first canvas is drawn from. `projectRef` holds the latest
// project and `commitProject(next)` replaces it, so two edits in one tick both see the result of
// the first. A rejected edit is spoken through `announce`, written to the console once per problem
// and kept in `editRejection` until the next accepted edit, a replaced project or Dismiss. It never
// moves focus; Dismiss gives it back to where it was. `onAccepted(project)` gets the project of
// each accepted edit that changed something, from the edit's result, not from React state.
export const useCanvasEdits = ({
  initialProject,
  projectRef,
  commitProject,
  canvasElementRef,
  announce,
  onAccepted,
}) => {
  const [canvas, setCanvasState] = useState(() => syncCanvas(NO_CANVAS, initialProject))
  // The newest canvas, written only where the state is set, so an edit never starts from one a
  // handler captured at render time.
  const latestCanvas = useRef(canvas)
  const focusAfterDelete = useFocusAfterDelete({ canvasElementRef })
  const [editState, setEditState] = useState(INITIAL_EDIT_STATE)
  // The newest edit state, written only where the state is set, so two edits in one tick both
  // reduce from the result of the first.
  const latestEditState = useRef(editState)
  const editPanelRef = useRef(null)

  const setCanvas = useCallback((next) => {
    latestCanvas.current = next
    setCanvasState(next)
  }, [])

  const dispatchEdit = useCallback(
    (event) => {
      const { state, announcement } = reduceEdit(latestEditState.current, event)
      latestEditState.current = state
      setEditState(state)
      if (announcement) announce(announcement)
    },
    [announce],
  )

  const applyEdit = useCallback(
    (commands) => {
      const result = runEdit(
        { project: projectRef.current, canvas: latestCanvas.current },
        commands,
        { newId },
      )
      commitProject(result.project)
      setCanvas(result.canvas)
      const isFocusInPanel = editPanelRef.current?.contains(document.activeElement) ?? false
      // A rejection shown for the first time or again: focus stays where it is, and Dismiss
      // returns there. Inside the panel itself, the canvas is the place to return to.
      const focusReturn = isFocusInPanel ? canvasElementRef.current : document.activeElement
      const event = toEditEvent(result, focusReturn)
      if (event) {
        dispatchEdit(event)
        if (event.type === EDIT_EVENT.rejected) result.problems.forEach(report)
        if (event.type === EDIT_EVENT.accepted) onAccepted(result.project)
        // The panel closes, so focus inside it would be lost.
        if (event.type === EDIT_EVENT.accepted && isFocusInPanel) canvasElementRef.current?.focus()
      }
      return result
    },
    [projectRef, commitProject, setCanvas, dispatchEdit, canvasElementRef, onAccepted],
  )

  // Opens `next` in place of the project: the canvas is drawn afresh from it, and the rejection
  // shown, which belonged to the map that is gone, is cleared.
  const replaceProject = useCallback(
    (next) => {
      commitProject(next)
      setCanvas(syncCanvas(NO_CANVAS, next))
      dispatchEdit({ type: EDIT_EVENT.importReplaced })
    },
    [commitProject, setCanvas, dispatchEdit],
  )

  const dismissEditProblems = useCallback(() => {
    const { focusReturn } = latestEditState.current
    dispatchEdit({ type: EDIT_EVENT.dismiss })
    pickFocusTarget(focusReturn, canvasElementRef.current)?.focus()
  }, [dispatchEdit, canvasElementRef])

  const onNodesChange = useCallback(
    (changes) => {
      const { nodes, edges } = latestCanvas.current
      setCanvas({ nodes: applyNodeChanges(changes.filter(isNotRemoval), nodes), edges })
      const edit = moveEdit(changes, projectRef.current)
      if (edit.length > 0) applyEdit(edit)
    },
    [projectRef, applyEdit, setCanvas],
  )

  const onEdgesChange = useCallback(
    (changes) => {
      const { nodes, edges } = latestCanvas.current
      setCanvas({ nodes, edges: applyEdgeChanges(changes.filter(isNotRemoval), edges) })
    },
    [setCanvas],
  )

  const onConnect = useCallback((params) => applyEdit(connectEdit(params)), [applyEdit])

  // Returns false so React Flow removes nothing itself: the edit does.
  const onBeforeDelete = useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      const { nodes } = latestCanvas.current
      const { shouldMoveFocus } = applyEdit(
        deleteEdit({ nodes: deletedNodes, edges: deletedEdges }),
      )
      if (shouldMoveFocus) focusAfterDelete({ nodes, deletedNodes, deletedEdges })
      return false
    },
    [applyEdit, focusAfterDelete],
  )

  return {
    nodes: canvas.nodes,
    edges: canvas.edges,
    applyEdit,
    replaceProject,
    editRejection: editState.rejection,
    editPanelRef,
    dismissEditProblems,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onBeforeDelete,
  }
}
