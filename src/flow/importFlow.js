import { toExportEdge, toExportNode } from './projectFile.js'
import { toProblemsView } from './problemsView.js'
import { withAriaLabel } from './step.js'
import { formatCount } from './text.js'

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

// AC15: shown in place of EDITED_NOTICE for an unedited file marked as changed by an AI tool.
// `date` is YYYY-MM-DD.
export const AI_NOTICE = (tool, date) =>
  `This file was changed by AI tools (${tool}) on ${date}. Review the steps and numbers before relying on them.`

// The mark's time is ISO 8601 with a zone (validation requires one); the notice names the UTC day.
const utcDate = (at) => new Date(at).toISOString().slice(0, 10)

const describeChangedBy = (changedBy) =>
  changedBy ? AI_NOTICE(changedBy.tool, utcDate(changedBy.at)) : null

// The notices that apply to an imported file, in the order they are shown and spoken.
const noticesFor = (isEdited, aiNotice) =>
  [isEdited ? EDITED_NOTICE : null, aiNotice].filter(Boolean)

const describeRejection = (problems) =>
  `Import rejected: ${formatCount(problems.length, 'problem')}`

export const INITIAL_IMPORT_STATE = Object.freeze({ type: IMPORT_IDLE, status: null })

// The allowlist an export writes is the allowlist an import reads: unknown keys in the file
// (style, className, hidden, ...) never reach React Flow. Each node is named by its step title.
export const fromProjectFile = (file) => ({
  nodes: file.nodes.map((node, index) => withAriaLabel(toExportNode(node), index)),
  edges: file.edges.map(toExportEdge),
})

const describeImported = (name, stepCount, notices) => {
  const outcome = `Imported ${name}, ${formatCount(stepCount, 'step')}`
  return notices.length > 0 ? `${outcome}. ${notices.join(' ')}` : outcome
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

const rejectFile = (problems) =>
  transition(
    { type: IMPORT_ERROR, problems },
    { announcement: `${describeRejection(problems)}. ${problems[0].message}` },
  )

const acceptFile = (state, { result: { file, edited, changedBy }, project }) => {
  const notices = noticesFor(edited === true, describeChangedBy(changedBy))
  const isSame = isSameName(project, file.project)
  const message = describeConfirmation(isSame, file.project.name)
  return transition(
    {
      type: IMPORT_CONFIRMING,
      // The last outcome, so a cancel puts it back: a success line stays until the next import.
      status: state.status ?? null,
      file,
      notices,
      currentName: project.name,
      incomingName: file.project.name,
      message,
      // Same name keeps the open project's id; a different name takes the file's name and id.
      project: isSame
        ? { id: project.id, name: project.name }
        : { id: file.project.id, name: file.project.name },
    },
    // The dialog shows the notices, so a file with one speaks it when the dialog opens.
    { announcement: notices.length > 0 ? `${message} ${notices.join(' ')}` : null },
  )
}

const receiveFile = (state, event) =>
  event.result.ok ? acceptFile(state, event) : rejectFile(event.result.problems)

const confirmReplace = (state) => {
  const announcement = describeImported(state.project.name, state.file.nodes.length, state.notices)
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
 * What the visible status shows for a state: the last outcome (idle) or the rejection. Nothing
 * shows while a confirmation is pending or before any import. A rejection is a shared problems
 * `view` (see toProblemsView) led by the count; an outcome is just `text`.
 * @returns {{ text: string, isError: false } | { isError: true,
 *   view: ReturnType<typeof toProblemsView> } | null}
 */
export const describeImportStatus = (state) => {
  if (state.type === IMPORT_ERROR) {
    return {
      isError: true,
      view: toProblemsView(describeRejection(state.problems), state.problems),
    }
  }
  if (state.type === IMPORT_IDLE && state.status) return { text: state.status, isError: false }
  return null
}

/**
 * Pure import flow.
 * State: { type: 'idle', status } | { type: 'confirming', status, file, notices, currentName,
 *   incomingName, message, project } | { type: 'error', problems: object[] }.
 * `notices` is the notice texts for the file, the edited notice first, then the AI notice.
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
