import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toExportDownload } from '../flow/projectFile.js'
import { downloadTextFile } from './download.js'
import { useCanvasEdits } from './useCanvasEdits.js'
import { useImportFlow } from './useImportFlow.js'

// The one in-memory project (`{ project, nodes, edges }`) and the canvas drawn from it. Export,
// the metrics and the canvas all read it; the canvas edits and import's replacement write it.
// `initial` is the project as opened from the store. `saveProject` (from the store) saves the
// project after every accepted change, the canvas edits' and import's; a save is not awaited, and
// one that fails is announced as "Not saved. <message>".
export const useProject = ({
  initial,
  saveProject,
  announce,
  importButtonRef,
  canvasElementRef,
}) => {
  const [project, setProject] = useState(initial)
  // The newest project, written only where the project is set, so a handler never reads one it
  // captured at render time.
  const latestProject = useRef(project)
  const commitProject = useCallback((next) => {
    latestProject.current = next
    setProject(next)
  }, [])
  const onAccepted = useCallback(
    async (next) => {
      const saved = await saveProject(next)
      if (!saved.ok) announce(`Not saved. ${saved.problems[0].message}`)
    },
    [saveProject, announce],
  )
  const canvasEdits = useCanvasEdits({
    initialProject: project,
    projectRef: latestProject,
    commitProject,
    canvasElementRef,
    announce,
    onAccepted,
  })
  // `replaceProject` serves import alone, so it stays out of what the hook returns.
  const { replaceProject, ...editActions } = canvasEdits
  const { fitView } = useReactFlow()
  // Fitting must wait for React Flow to hold the replaced nodes, so a replacement only asks for it.
  const [fitRequestCount, setFitRequestCount] = useState(0)
  const applyReplacement = useCallback(
    (replacement) => {
      replaceProject(replacement)
      onAccepted(replacement)
      setFitRequestCount((count) => count + 1)
    },
    [replaceProject, onAccepted],
  )
  useEffect(() => {
    if (fitRequestCount > 0) fitView()
  }, [fitRequestCount, fitView])
  const getCurrentProject = useCallback(() => latestProject.current.project, [])
  const importFlow = useImportFlow({
    getCurrentProject,
    onReplace: applyReplacement,
    announce,
    returnFocusRef: importButtonRef,
  })
  // Returns the downloaded file name so the caller can announce it.
  const exportProject = useCallback(async () => {
    const { fileName, text } = await toExportDownload(latestProject.current, new Date())
    downloadTextFile(fileName, text)
    return fileName
  }, [])
  return {
    projectName: project.project.name,
    steps: project.nodes.map((node) => node.data),
    exportProject,
    ...editActions,
    ...importFlow,
  }
}
