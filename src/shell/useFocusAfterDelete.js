import { useCallback } from 'react'
import { pickFocusAfterDelete } from '../flow/focusAfterDelete.js'

const findStepElement = (canvas, stepId) =>
  [...canvas.querySelectorAll('.react-flow__node')].find((element) => element.dataset.id === stepId)

// Returns the onDelete handler for React Flow. The deleted element held focus, so hand it to a
// remaining step, or to the canvas when none is left.
export const useFocusAfterDelete = ({ nodes, canvasRef }) =>
  useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      const canvas = canvasRef.current
      const stepId = pickFocusAfterDelete({ nodes, deletedNodes, deletedEdges })
      const target = stepId === null ? canvas : (findStepElement(canvas, stepId) ?? canvas)
      target.focus()
    },
    [nodes, canvasRef],
  )
