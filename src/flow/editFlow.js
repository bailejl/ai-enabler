import { syncCanvas } from './canvas.js'
import { EDIT_COMMAND_NAMES, applyCommands } from './commands/index.js'
import { toRejection } from './problemsView.js'

export const EDIT_EVENT = Object.freeze({
  rejected: 'rejected',
  accepted: 'accepted',
  dismiss: 'dismiss',
  importReplaced: 'importReplaced',
})

export const INITIAL_EDIT_STATE = Object.freeze({ rejection: null, focusReturn: null })

/**
 * Runs one edit (a list of commands) as a whole and redraws the canvas from the result. The
 * canvas is always rebuilt from the resulting project, so a rejected edit snaps the view back to
 * the project (a dragged card returns). Focus is asked to move only for an accepted edit that
 * changed something; an empty edit is accepted, changes nothing and does not ask. A command that
 * replaces the project (create_project) belongs to import, so an edit holding one is rejected as
 * an unknown command and nothing changes.
 * @param {{ project: object, canvas: { nodes: object[], edges: object[] } }} current
 * @param {{ name: string, args?: object }[]} commands
 * @param {{ newId: () => string }} context
 * @returns {{ project: object, canvas: { nodes: object[], edges: object[] }, ok: boolean,
 *   changed: boolean, problems: object[], shouldMoveFocus: boolean }}
 */
export const runEdit = ({ project, canvas }, commands, context) => {
  const result = applyCommands(project, commands, { ...context, commandNames: EDIT_COMMAND_NAMES })
  return {
    project: result.project,
    canvas: syncCanvas(canvas, result.project),
    ok: result.ok,
    changed: result.changed,
    problems: result.problems,
    shouldMoveFocus: result.ok && result.changed,
  }
}

/**
 * The event to dispatch for a `runEdit` result, or null when there is nothing to tell the panel:
 * an empty edit leaves a shown rejection as it is. `focusReturn` is where focus was when a
 * rejection is shown, so Dismiss can give it back.
 */
export const toEditEvent = (result, focusReturn = null) => {
  if (!result.ok) {
    return { type: EDIT_EVENT.rejected, problems: result.problems, focusReturn }
  }
  return result.changed ? { type: EDIT_EVENT.accepted } : null
}

// A transition returns the next state and the text to speak (or null).
const transition = (state, announcement = null) => ({ state, announcement })

const showRejection = (_state, { problems, focusReturn = null }) => {
  const { view, announcement } = toRejection('Edit', problems)
  return transition({ rejection: view, focusReturn }, announcement)
}

const clearRejection = () => transition(INITIAL_EDIT_STATE)

const HANDLERS = {
  [EDIT_EVENT.rejected]: showRejection,
  [EDIT_EVENT.accepted]: clearRejection,
  [EDIT_EVENT.dismiss]: clearRejection,
  // The map a rejection refers to is gone.
  [EDIT_EVENT.importReplaced]: clearRejection,
}

/**
 * Pure state of the edit problems panel.
 * State: { rejection: ReturnType<typeof toProblemsView> | null, focusReturn: unknown }.
 * Events: { type: 'rejected', problems, focusReturn }, { type: 'accepted' }, { type: 'dismiss' },
 *   { type: 'importReplaced' }. A rejection replaces any shown one; the others clear it. An
 *   event of any other type changes nothing.
 * @returns {{ state: object, announcement: string | null }}
 */
export const reduceEdit = (state, event) => {
  return Object.hasOwn(HANDLERS, event.type)
    ? HANDLERS[event.type](state, event)
    : transition(state)
}
