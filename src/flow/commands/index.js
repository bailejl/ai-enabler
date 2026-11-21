import { problem } from '../diagnostics/problem.js'
import { validateProjectFile } from '../schema/validate.js'
import { isObject } from '../schema/primitives.js'

// User text echoed into a message or summary is cut to this many characters. The full text stays
// in `untrusted`.
const MAX_ECHOED_TEXT = 80

const shorten = (value) => {
  const text = String(value)
  return text.length > MAX_ECHOED_TEXT ? `${text.slice(0, MAX_ECHOED_TEXT - 1)}…` : text
}

// The command table: each name maps to the arguments it accepts and a pure `apply`. `apply` gets
// the current project, the checked args and the context, and returns either `{ project, summary,
// created? }` or `{ problems }`. It never mutates its input and never validates: applyCommand
// validates the candidate. Names are the MCP tool names.
const COMMANDS = {
  create_project: {
    args: ['name'],
    apply: (_project, { name }, { newId }) => ({
      project: { project: { id: newId(), name }, nodes: [], edges: [] },
      summary: `Created project "${shorten(name)}"`,
    }),
  },
}

const COMMAND_NAMES = Object.keys(COMMANDS)

const commandLabel = (name) => (typeof name === 'string' ? shorten(name) : '(no name)')

const unknownCommand = (name) =>
  problem('CMD_UNKNOWN', {
    params: { command: commandLabel(name), commands: COMMAND_NAMES.join(', ') },
    untrusted: { command: name },
  })

const checkArgs = (name, entry, args) => {
  if (!isObject(args)) return [problem('CMD_ARGUMENTS_INVALID', { params: { command: name } })]
  const unknown = Object.keys(args).filter((key) => !entry.args.includes(key))
  if (unknown.length === 0) return []
  return [
    problem('CMD_ARGUMENT_UNKNOWN', {
      params: {
        command: name,
        arguments: unknown.map(shorten).join(', '),
        accepted: entry.args.join(', ') || 'none',
      },
      untrusted: { arguments: unknown },
    }),
  ]
}

const rejectedSummary = (name, problems) =>
  `Rejected ${commandLabel(name)}: nothing changed (${problems.length} ${
    problems.length === 1 ? 'problem' : 'problems'
  })`

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
  const reject = (problems) => ({
    ok: false,
    project,
    problems,
    summary: rejectedSummary(name, problems),
  })
  if (!Object.hasOwn(COMMANDS, name)) return reject([unknownCommand(name)])
  const entry = COMMANDS[name]
  const argProblems = checkArgs(name, entry, args)
  if (argProblems.length > 0) return reject(argProblems)
  const change = entry.apply(project, args, context)
  if (change.problems) return reject(change.problems)
  const validation = validateProjectFile(change.project)
  if (!validation.ok) return reject(validation.problems)
  return {
    ok: true,
    project: change.project,
    problems: [],
    summary: change.summary,
    ...(change.created === undefined ? {} : { created: change.created }),
  }
}

export const createProject = (args, context) =>
  applyCommand(null, { name: 'create_project', args }, context)
