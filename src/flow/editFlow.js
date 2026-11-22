import { syncCanvas } from './canvas.js'
import { applyCommands } from './commands/index.js'
import { toProblemsView } from './problemsView.js'
import { formatCount } from './text.js'

export const EDIT_EVENT = Object.freeze({
  rejected: 'rejected',
  accepted: 'accepted',
  dismiss: 'dismiss',
  importReplaced: 'importReplaced',
})

export const INITIAL_EDIT_STATE = Object.freeze({ rejection: null, focusReturn: null })

const describeRejection = (problems) => `Edit rejected: ${formatCount(problems.length, 'problem')}`

/**
 * Runs one edit (a list of commands) as a whole and redraws the canvas from the result. The
 * canvas is always rebuilt from the resulting project, so a rejected edit snaps the view back to
 * the project (a dragged card returns). Focus is asked to move only for an accepted edit that
 * changed something; an empty edit is accepted, changes nothing and does not ask.
 * @param {{ project: object, canvas: { nodes: object[], edges: object[] } }} current
 * @param {{ name: string, args?: object }[]} commands
 * @param {{ newId: () => string }} context
 * @returns {{ project: object, canvas: { nodes: object[], edges: object[] }, ok: boolean,
 *   changed: boolean, problems: object[], moveFocus: boolean }}
 */
export const runEdit = ({ project, canvas }, commands, context) => {
  const result = applyCommands(project, commands, context)
  return {
    project: result.project,
    canvas: syncCanvas(canvas, result.project),
    ok: result.ok,
    changed: result.changed,
    problems: result.problems,
    moveFocus: result.ok && result.changed,
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
  const heading = describeRejection(problems)
  return transition(
    { rejection: toProblemsView(heading, problems), focusReturn },
    `${heading}. ${problems[0].message}`,
  )
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
