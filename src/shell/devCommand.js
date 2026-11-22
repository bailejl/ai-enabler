import { replacesProject } from '../flow/commands/index.js'

// The dev-only command event. `App.jsx` listens for it only in dev, so e2e tests can send an edit
// to the loaded map. It is dispatched with
// `new CustomEvent(DEV_COMMAND_EVENT, { detail: { commands: [{ name, args }] } })`.

export const DEV_COMMAND_EVENT = 'aie-dev-command'

// Set on <html> while the listener is attached.
export const DEV_COMMAND_READY_ATTRIBUTE = 'data-aie-dev-command-ready'

const isEntry = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The commands an event's `detail` asks for, as a non-empty list of `{ name, args }`, or `null`
 * when `detail` has no commands, an entry is not an object, or a command replaces the project
 * (that belongs to import). An unknown name is passed on: the command layer rejects it.
 */
export const parseDevCommand = (detail) => {
  const commands = detail?.commands
  if (!Array.isArray(commands) || commands.length === 0) return null
  if (!commands.every(isEntry) || commands.some(replacesProject)) return null
  return commands.map(({ name, args }) => ({ name, args }))
}
