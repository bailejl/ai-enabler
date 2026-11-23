import { useCallback, useEffect, useRef, useState } from 'react'
import { parseImport, unreadableImport } from '../flow/importFile.js'
import {
  IMPORT_CONFIRMING,
  IMPORT_ERROR,
  IMPORT_EVENT,
  INITIAL_IMPORT_STATE,
  reduceImport,
} from '../flow/importFlow.js'
import { report } from './diagnostics.js'

// A file the browser cannot read is reported like any other file that cannot be imported.
export const readImport = async (file) => {
  try {
    return await parseImport(await file.text())
  } catch {
    return unreadableImport()
  }
}

/**
 * Runs import events through the pure reducer and performs what it asks for: speak, hand the
 * replacement to `onReplace`, write each rejected problem to the console as a diagnostic record,
 * and give focus back to `returnFocusRef` once the dialog (if any) has gone. A rejection keeps
 * focus off it: the status heading takes it, and Dismiss returns it.
 *
 * `getCurrentProject()` returns the `{ id, name }` of the project the import replaces, read when
 * a file is parsed and again at confirm, so a change while the dialog is open is not undone and
 * the project keeps its id. The header and a card's "Replace from file" share this hook.
 *
 * `onReplace` may return (or resolve to) false when it could not keep the replacement; the outcome
 * line then clears and nothing is announced, so it never says a refused save was imported. A
 * replacement's outcome is announced only once `onReplace` has kept it. `resetImport` clears the line
 * when another status takes its place; neither moves focus, and neither closes a pending question.
 */
export const useImportFlow = ({ getCurrentProject, onReplace, announce, returnFocusRef }) => {
  const [importState, setImportState] = useState(INITIAL_IMPORT_STATE)
  const previousState = useRef(importState)
  // The newest state, written only where a state is set. The reducer runs against this, not the
  // state a callback captured at render time, so a dispatch after an `await` sees every earlier one.
  const latestImportState = useRef(importState)
  const latestRequestId = useRef(0)
  // Set by a reset, which leaves focus where the user is.
  const isQuietReset = useRef(false)
  useEffect(() => {
    const hasChanged = previousState.current !== importState
    previousState.current = importState
    const keepsFocus = importState.type === IMPORT_CONFIRMING || importState.type === IMPORT_ERROR
    const isQuiet = isQuietReset.current
    isQuietReset.current = false
    if (hasChanged && !keepsFocus && !isQuiet) returnFocusRef.current?.focus()
  }, [importState, returnFocusRef])

  const resetImport = useCallback(() => {
    const previous = latestImportState.current
    if (previous.type === IMPORT_CONFIRMING) return
    const { state } = reduceImport(previous, { type: IMPORT_EVENT.reset })
    if (state === previous) return
    isQuietReset.current = true
    latestImportState.current = state
    setImportState(state)
  }, [])

  const dispatchImport = useCallback(
    (event) => {
      const previous = latestImportState.current
      const { state, announcement, replacement } = reduceImport(previous, event)
      latestImportState.current = state
      // Reported where the rejection happens, never in an effect, so each problem is written once.
      if (state !== previous && state.type === IMPORT_ERROR) state.problems.forEach(report)
      setImportState(state)
      if (!replacement) {
        if (announcement) announce(announcement)
        return
      }
      Promise.resolve(onReplace(replacement)).then((kept) => {
        if (kept === false) resetImport()
        else if (announcement) announce(announcement)
      })
    },
    [announce, onReplace, resetImport],
  )

  // When two reads overlap, only the one started last may change the state.
  const importFile = useCallback(
    async (file) => {
      latestRequestId.current += 1
      const requestId = latestRequestId.current
      const result = await readImport(file)
      if (requestId === latestRequestId.current) {
        dispatchImport({ type: IMPORT_EVENT.fileParsed, result, project: getCurrentProject() })
      }
    },
    [dispatchImport, getCurrentProject],
  )
  const confirmImport = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.confirm, project: getCurrentProject() }),
    [dispatchImport, getCurrentProject],
  )
  const cancelImport = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.cancel }),
    [dispatchImport],
  )
  const dismissImportError = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.dismiss }),
    [dispatchImport],
  )

  return { importState, importFile, confirmImport, cancelImport, dismissImportError, resetImport }
}
