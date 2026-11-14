import { toExportEdge, toExportNode } from './projectFile.js'
import { withAriaLabel } from './step.js'

export const IMPORT_IDLE = 'idle'
export const IMPORT_CONFIRMING = 'confirming'
export const IMPORT_ERROR = 'error'

export const IMPORT_EVENT = Object.freeze({
  fileParsed: 'fileParsed',
  confirm: 'confirm',
  cancel: 'cancel',
  dismiss: 'dismiss',
})

export const IMPORT_CANCELLED = 'Import cancelled'

// AC48: shown in the confirmation and the outcome line for a file that does not match its hash.
export const EDITED_NOTICE = 'This file was changed outside AI Enabler after it was exported.'

export const INITIAL_IMPORT_STATE = Object.freeze({ type: IMPORT_IDLE, status: null })

// The allowlist an export writes is the allowlist an import reads: unknown keys in the file
// (style, className, hidden, ...) never reach React Flow. Each node is named by its step title.
export const fromProjectFile = (file) => ({
  nodes: file.nodes.map((node, index) => withAriaLabel(toExportNode(node), index)),
  edges: file.edges.map(toExportEdge),
})

const describeImported = (name, stepCount, isEdited) => {
  const outcome = `Imported ${name}, ${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`
  return isEdited ? `${outcome}. ${EDITED_NOTICE}` : outcome
}

// D2: exact match, no case folding, no trimming. The file's id never decides.
const isSameName = (current, incoming) => current.name === incoming.name

const describeConfirmation = (isSame, incomingName) =>
  isSame
    ? `Replace current map with the imported version of ${incomingName}?`
    : `Replace current map with ${incomingName}?`

// A transition returns the next state plus what to do about it: the text to speak (or null) and
// the project and map to apply (or null). Only `confirm` from `confirming` replaces anything.
const transition = (state, { announcement = null, replacement = null } = {}) => ({
  state,
  announcement,
  replacement,
})

const stay = (state) => transition(state)

const receiveFile = (state, { result, project }) => {
  if (!result.ok) {
    return transition(
      { type: IMPORT_ERROR, message: result.message },
      { announcement: result.message },
    )
  }
  const { file, edited } = result
  const isEdited = edited === true
  const isSame = isSameName(project, file.project)
  const message = describeConfirmation(isSame, file.project.name)
  return transition(
    {
      type: IMPORT_CONFIRMING,
      // The last outcome, so a cancel puts it back: a success line stays until the next import.
      status: state.status ?? null,
      file,
      isEdited,
      currentName: project.name,
      incomingName: file.project.name,
      message,
      // Same name keeps the open project's id; a different name takes the file's name and id.
      project: isSame
        ? { id: project.id, name: project.name }
        : { id: file.project.id, name: file.project.name },
    },
    // The dialog shows the notice, so an edited file speaks it when the dialog opens.
    { announcement: isEdited ? `${message} ${EDITED_NOTICE}` : null },
  )
}

const confirmReplace = (state) => {
  const announcement = describeImported(state.project.name, state.file.nodes.length, state.isEdited)
  return transition(
    { type: IMPORT_IDLE, status: announcement },
    { announcement, replacement: { project: state.project, ...fromProjectFile(state.file) } },
  )
}

const cancelConfirmation = (state) =>
  transition({ type: IMPORT_IDLE, status: state.status }, { announcement: IMPORT_CANCELLED })

const HANDLERS = {
  [IMPORT_EVENT.fileParsed]: { from: null, run: receiveFile },
  [IMPORT_EVENT.confirm]: { from: IMPORT_CONFIRMING, run: confirmReplace },
  [IMPORT_EVENT.cancel]: { from: IMPORT_CONFIRMING, run: cancelConfirmation },
  [IMPORT_EVENT.dismiss]: { from: IMPORT_ERROR, run: () => transition(INITIAL_IMPORT_STATE) },
}

/**
 * What the visible status line shows for a state: the last outcome (idle) or the error. Nothing
 * shows while a confirmation is pending or before any import.
 * @returns {{ text: string, isError: boolean } | null}
 */
export const describeImportStatus = (state) => {
  if (state.type === IMPORT_ERROR) return { text: state.message, isError: true }
  if (state.type === IMPORT_IDLE && state.status) return { text: state.status, isError: false }
  return null
}

/**
 * Pure import flow.
 * State: { type: 'idle', status } | { type: 'confirming', status, file, isEdited, currentName,
 *   incomingName, message, project } | { type: 'error', message }.
 * Events: { type: 'fileParsed', result: parseImport's result, project: { id, name } },
 *   { type: 'confirm' }, { type: 'cancel' }, { type: 'dismiss' }.
 * @returns {{ state: object, announcement: string | null,
 *   replacement: { project: { id: string, name: string }, nodes: object[], edges: object[] } | null }}
 */
export const reduceImport = (state, event) => {
  const handler = HANDLERS[event.type]
  const isHandled = handler && (handler.from === null || handler.from === state.type)
  return isHandled ? handler.run(state, event) : stay(state)
}
