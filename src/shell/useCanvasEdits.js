import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import { connectEdit, deleteEdit, moveEdit, syncCanvas } from '../flow/canvas.js'
import { runEdit } from '../flow/editFlow.js'
import { useFocusAfterDelete } from './useFocusAfterDelete.js'

const newId = () => crypto.randomUUID()
const NO_CANVAS = { nodes: [], edges: [] }
const isViewChange = (change) => change.type !== 'remove'

// The canvas React Flow draws, and the handlers that turn what the user does on it into edits of
// the project. Every edit goes through `applyEdit`: the project decides, and the canvas is rebuilt
// from it whether the edit was accepted or rejected. A removal never reaches the view directly:
// the delete handler returns false and the project change removes the items.
// `initialProject` is the project the first canvas is drawn from. `projectRef` holds the latest
// project and `commitProject(next)` replaces it, so two edits in one tick both see the result of
// the first.
export const useCanvasEdits = ({ initialProject, projectRef, commitProject, canvasElementRef }) => {
  const [canvas, setCanvasState] = useState(() => syncCanvas(NO_CANVAS, initialProject))
  // The newest canvas, written only where the state is set, so an edit never starts from one a
  // handler captured at render time.
  const latestCanvas = useRef(canvas)
  const focusAfterDelete = useFocusAfterDelete({ canvasRef: canvasElementRef })

  const setCanvas = useCallback((next) => {
    latestCanvas.current = next
    setCanvasState(next)
  }, [])

  const applyEdit = useCallback(
    (commands) => {
      const result = runEdit(
        { project: projectRef.current, canvas: latestCanvas.current },
        commands,
        { newId },
      )
      commitProject(result.project)
      setCanvas(result.canvas)
      return result
    },
    [projectRef, commitProject, setCanvas],
  )

  const onNodesChange = useCallback(
    (changes) => {
      const { nodes, edges } = latestCanvas.current
      setCanvas({ nodes: applyNodeChanges(changes.filter(isViewChange), nodes), edges })
      const edit = moveEdit(changes, projectRef.current)
      if (edit.length > 0) applyEdit(edit)
    },
    [projectRef, applyEdit, setCanvas],
  )

  const onEdgesChange = useCallback(
    (changes) => {
      const { nodes, edges } = latestCanvas.current
      setCanvas({ nodes, edges: applyEdgeChanges(changes.filter(isViewChange), edges) })
    },
    [setCanvas],
  )

  const onConnect = useCallback((params) => applyEdit(connectEdit(params)), [applyEdit])

  // Returns false so React Flow removes nothing itself: the edit does.
  const onBeforeDelete = useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      const { nodes } = latestCanvas.current
      const { moveFocus } = applyEdit(deleteEdit({ nodes: deletedNodes, edges: deletedEdges }))
      if (moveFocus) focusAfterDelete({ nodes, deletedNodes, deletedEdges })
      return false
    },
    [applyEdit, focusAfterDelete],
  )

  return {
    nodes: canvas.nodes,
    edges: canvas.edges,
    setCanvas,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onBeforeDelete,
  }
}
