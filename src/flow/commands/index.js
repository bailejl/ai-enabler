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
// the MCP tool names. A command works on the open project unless `needsProject` is false.
const COMMANDS = {
  create_project: {
    args: ['name'],
    needsProject: false,
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
  `Rejected ${nameLabel(name)}: nothing changed (${formatCount(problems.length, 'problem')})`

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

export const createProject = (args, context) =>
  applyCommand(null, { name: 'create_project', args }, context)
