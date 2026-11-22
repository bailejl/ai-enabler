import { problem } from '../diagnostics/problem.js'
import { validateProjectFile } from '../schema/validate.js'
import { isObject } from '../schema/primitives.js'
import { formatCount, nameLabel, quoted, shorten } from '../text.js'
import { CONNECTION_COMMANDS } from './connections.js'
import { STEP_COMMANDS } from './steps.js'

// The command table: each name maps to the arguments it accepts and a pure `apply`. `apply` gets
// the current project, the checked args and the context. It returns `{ problems }` when there is
// no candidate to check, or `{ project, summary, created?, problems? }`: the candidate, a function
// that builds the summary (applyCommand calls it only once the candidate is valid, so it never
// sees unchecked values) and the command's own problems, which are reported with the candidate's.
// It never mutates its input and never validates: applyCommand validates the candidate. Names are
// the MCP tool names, except for `uiOnly` commands: those serve the app alone and are not tools.
// A command works on the open project unless `needsProject` is false, and `replacesProject` marks
// one that starts a new project in place of the open one.
export const COMMANDS = {
  create_project: {
    args: ['name'],
    needsProject: false,
    replacesProject: true,
    apply: (_project, { name }, { newId }) => ({
      project: { project: { id: newId(), name }, nodes: [], edges: [] },
      summary: () => `Created project ${quoted(name)}`,
    }),
  },
  ...STEP_COMMANDS,
  ...CONNECTION_COMMANDS,
}

const COMMAND_NAMES = Object.keys(COMMANDS)

const unknownCommand = (name) =>
  problem('CMD_UNKNOWN', {
    params: { command: nameLabel(name), commands: COMMAND_NAMES.join(', ') },
    untrusted: { command: name },
  })

// The message names this many unknown arguments; the rest are counted, and `untrusted` lists all.
const MAX_LISTED_ARGUMENTS = 10

const listArguments = (names) => {
  const listed = names.slice(0, MAX_LISTED_ARGUMENTS).map(shorten).join(', ')
  const rest = names.length - MAX_LISTED_ARGUMENTS
  return rest > 0 ? `${listed}, and ${rest} more` : listed
}

// The problems with the args a tool was sent: not an object, or an argument the entry does not list.
export const checkArgs = (name, entry, args) => {
  if (!isObject(args)) return [problem('CMD_ARGUMENTS_INVALID', { params: { command: name } })]
  const unknown = Object.keys(args).filter((key) => !entry.args.includes(key))
  if (unknown.length === 0) return []
  return [
    problem('CMD_ARGUMENT_UNKNOWN', {
      params: {
        command: name,
        arguments: listArguments(unknown),
        accepted: entry.args.join(', ') || 'none',
      },
      untrusted: { arguments: unknown },
    }),
  ]
}

/**
 * True when the command starts a new project in place of the open one (create_project), so the
 * caller can guard the open project first. False for anything else, including a malformed command.
 */
export const replacesProject = (command) =>
  typeof command?.name === 'string' &&
  Object.hasOwn(COMMANDS, command.name) &&
  COMMANDS[command.name].replacesProject === true

/**
 * The result of a command that changed nothing: `{ ok: false, problems, summary }`.
 * @param {string} name The command name; shown cut short and never as part of the problems.
 * @param {object[]} problems
 */
export const rejectCommand = (name, problems) => ({
  ok: false,
  problems,
  summary: `Rejected ${nameLabel(name)}: nothing changed (${formatCount(problems.length, 'problem')})`,
})

/**
 * Applies one command to the in-memory project (the project file shape without schemaVersion,
 * exportedAt or contentHash) and validates the result. A rejected command returns the same
 * `project` object it was given, so nothing changes.
 * @param {object|null} project
 * @param {{ name: string, args?: object }} command
 * @param {{ newId: () => string }} context newId is injected so ids are deterministic in tests.
 * @returns {{ ok: boolean, project: object|null, problems: object[], summary: string, created?: string }}
 */
export const applyCommand = (project, command, context) => {
  const { name, args = {} } = command ?? {}
  const reject = (problems) => ({ ...rejectCommand(name, problems), project })
  if (typeof name !== 'string' || !Object.hasOwn(COMMANDS, name)) {
    return reject([unknownCommand(name)])
  }
  const entry = COMMANDS[name]
  if (entry.needsProject !== false && !isObject(project)) {
    return reject([problem('CMD_NO_PROJECT')])
  }
  const argProblems = checkArgs(name, entry, args)
  if (argProblems.length > 0) return reject(argProblems)
  const change = entry.apply(project, args, context)
  const ownProblems = change.problems ?? []
  if (!change.project) return reject(ownProblems)
  const problems = [...ownProblems, ...validateProjectFile(change.project).problems]
  if (problems.length > 0) return reject(problems)
  return {
    ok: true,
    project: change.project,
    problems: [],
    summary: change.summary(),
    ...(change.created === undefined ? {} : { created: change.created }),
  }
}
