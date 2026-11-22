import { useCallback, useEffect, useState } from 'react'
import { pickFocusAfterDelete } from '../flow/focusAfterDelete.js'

const findStepElement = (canvas, stepId) =>
  [...canvas.querySelectorAll('.react-flow__node')].find((element) => element.dataset.id === stepId)

// Returns a function to call, in the handler that applies a delete, with the steps as they were
// before it (`nodes`) and the deleted steps and connections. The deleted element held focus, so
// focus goes to a remaining step, or to the canvas when none is left. It moves in an effect, so the
// canvas has committed the edit and the step is looked up in what is now drawn.
export const useFocusAfterDelete = ({ canvasRef }) => {
  const [request, setRequest] = useState(null)
  useEffect(() => {
    if (request === null) return
    const canvas = canvasRef.current
    const target =
      request.stepId === null ? canvas : (findStepElement(canvas, request.stepId) ?? canvas)
    target.focus()
  }, [request, canvasRef])
  return useCallback(
    ({ nodes, deletedNodes, deletedEdges }) =>
      setRequest({ stepId: pickFocusAfterDelete({ nodes, deletedNodes, deletedEdges }) }),
    [],
  )
}
