import { COMMANDS, checkArgs, isToolEntry, rejectCommand } from '../src/flow/commands/index.js'
import { isCatalogCode, problem } from '../src/flow/diagnostics/problem.js'
import { allProblems, isKnownGate, runGate } from '../src/flow/gates/index.js'
import {
  EMPTY_SESSION,
  applyToSession,
  checkCanSwitch,
  discard,
  markSaved,
  openInto,
  planSave,
  toSaveFile,
} from '../src/flow/session.js'
import { serializeProjectFile } from '../src/flow/projectFile.js'
import { formatCount, nameLabel, quoted } from '../src/flow/text.js'
import { escapeControls } from './log.js'

// A result lists this many problems; `total` counts them all.
const MAX_PROBLEMS = 20

/** The server's name: what it announces to clients and writes into the `modifiedBy` mark of every file it saves. */
export const SERVER_NAME = 'aie-mcp'

// A whole number of zero or more: the rule for pt, lt, queue and batch.
const COUNT_SCHEMA = { type: 'integer', minimum: 0 }

// The JSON Schema for each argument, published as a hint only: the host checks every call itself.
const ARGUMENT_SCHEMAS = {
  name: { type: 'string' },
  stepId: { type: 'string' },
  sourceId: { type: 'string' },
  targetId: { type: 'string' },
  gate: { type: 'string' },
  code: { type: 'string' },
  pt: COUNT_SCHEMA,
  lt: COUNT_SCHEMA,
  ca: { type: 'number', minimum: 0, maximum: 100 },
  queue: COUNT_SCHEMA,
  batch: COUNT_SCHEMA,
}

// A command's arguments of these names are marked required in its schema; the metrics are not.
const REQUIRED_COMMAND_ARGUMENTS = ['name', 'stepId', 'sourceId', 'targetId']

const DESCRIPTIONS = {
  create_project: 'Start a new empty project with the given name. Blocked by unsaved changes.',
  rename_project: 'Rename the open project.',
  add_step: 'Add a step with a name and optional metrics. Returns the new step id as "created".',
  update_step: 'Rename a step.',
  remove_step: 'Remove a step and every connection to it.',
  set_step_metrics: 'Set metrics on a step: pt, lt, ca (percent), queue and batch.',
  connect: 'Connect one step to another, from source to target.',
  disconnect: 'Remove the connection from source to target.',
  open_project:
    'Open a saved project by file name from the projects folder. Returns its schemaVersion.',
  save_project: 'Save the open project. A project with no file yet needs a name.',
  discard_changes: 'Drop the unsaved changes and return to the project as last opened or saved.',
  get_project: 'Return the open project, with its steps and connections.',
  list_problems: 'List problems in the open project, for one gate or, with none, for all checks.',
  get_repair_guide: 'Return the repair guide for a problem code. Needs no open project.',
}

const reject = (session, tool, problems) => ({ session, result: rejectCommand(tool, problems) })

const succeed = (session, summary, extra = {}) => ({
  session,
  result: { ok: true, problems: [], summary, ...extra },
})

const runCommand =
  (tool) =>
  (session, args, { newId }) => {
    const {
      session: next,
      ok,
      problems,
      summary,
      created,
    } = applyToSession(session, { name: tool, args }, { newId })
    return {
      session: next,
      applied: ok,
      result: { ok, problems, summary, ...(created === undefined ? {} : { created }) },
    }
  }

const openProject = async (session, { name }, { store }) => {
  // Checked before the read, so a blocked open reports the unsaved changes whatever the file is.
  const blocked = checkCanSwitch(session)
  if (blocked.length > 0) return reject(session, 'open_project', blocked)
  const read = await store.read(name)
  if (!read.ok) return reject(session, 'open_project', read.problems)
  const opened = await openInto(session, read.text, name)
  if (!opened.ok) return reject(session, 'open_project', opened.problems)
  const steps = formatCount(opened.session.project.nodes.length, 'step')
  return succeed(opened.session, `Opened ${quoted(name)}: ${steps}`, {
    schemaVersion: opened.schemaVersion,
  })
}

const saveProject = async (session, args, { store, now }) => {
  const plan = planSave(session, args.name)
  if (!plan.ok) return reject(session, 'save_project', plan.problems)
  const built = await toSaveFile(session, { now: now(), tool: SERVER_NAME })
  const text = serializeProjectFile(built.file)
  const written = await store.write(plan.name, text, { mustBeNew: plan.mustBeNew })
  if (!written.ok) return reject(session, 'save_project', written.problems)
  return succeed(markSaved(session, built, plan.name), `Saved ${quoted(plan.name)}`)
}

const discardChanges = (session) => {
  const { session: next, discarded } = discard(session)
  return succeed(next, `Discarded ${formatCount(discarded, 'change')}`)
}

const getProject = (session) => {
  const { project, nodes, edges } = session.project
  const counts = `${formatCount(nodes.length, 'step')}, ${formatCount(edges.length, 'connection')}`
  return succeed(session, `Project ${quoted(project.name)}: ${counts}`, {
    project: session.project,
  })
}

const listProblems = (session, { gate }) => {
  if (gate !== undefined && !isKnownGate(gate)) {
    return reject(session, 'list_problems', runGate(session.project, gate).problems)
  }
  const problems =
    // Stryker disable next-line ConditionalExpression: with one gate registered and a project the
    // commands keep valid, all checks and that gate list the same problems; no test can tell them apart
    gate === undefined ? allProblems(session.project) : runGate(session.project, gate).problems
  const scope = gate === undefined ? 'All checks' : `Gate ${quoted(gate)}`
  return succeed(session, `${scope}: ${formatCount(problems.length, 'problem')}`, { problems })
}

// Pure lookup in the injected guide map. A value that is not a catalog code is refused before any
// lookup, and is echoed only through `nameLabel` in the message and as sent in `untrusted`. The
// string check comes first because `isCatalogCode` coerces its argument, so a one-item list of a
// code would pass it. A catalog code with no guide is a server fault, so it throws and `execute`
// answers CMD_INTERNAL_ERROR.
const getRepairGuide = (session, { code }, { guides }) => {
  if (typeof code !== 'string' || !isCatalogCode(code)) {
    return reject(session, 'get_repair_guide', [
      problem('CMD_CODE_UNKNOWN', {
        params: { code: nameLabel(code) },
        ...(code === undefined ? {} : { untrusted: { code } }),
      }),
    ])
  }
  const guide = guides[code]
  if (guide === undefined) throw new Error(`No repair guide for ${code}`)
  return succeed(session, `Repair guide for ${code}`, { code, guide })
}

// Every tool: its arguments (the only ones accepted), which of them a schema marks required, whether
// it needs an open project, and a `run(session, args, deps)` returning `{ session, result, applied? }`.
// The command tools come from the command table, so a new command always gets its tool, except a
// command flagged `uiOnly`: it serves the app alone and is not a tool.
const DEFINITIONS = [
  // applyCommand checks for an open project itself, with the same problem.
  ...Object.entries(COMMANDS)
    .filter(isToolEntry)
    .map(([name, { args }]) => ({
      name,
      args,
      required: args.filter((arg) => REQUIRED_COMMAND_ARGUMENTS.includes(arg)),
      needsProject: false,
      // applyCommand checks the arguments itself, so runTool does not check them again.
      checksOwnArgs: true,
      run: runCommand(name),
    })),
  {
    name: 'open_project',
    args: ['name'],
    required: ['name'],
    needsProject: false,
    run: openProject,
  },
  { name: 'save_project', args: ['name'], required: [], needsProject: true, run: saveProject },
  { name: 'discard_changes', args: [], required: [], needsProject: true, run: discardChanges },
  { name: 'get_project', args: [], required: [], needsProject: true, run: getProject },
  { name: 'list_problems', args: ['gate'], required: [], needsProject: true, run: listProblems },
  {
    name: 'get_repair_guide',
    args: ['code'],
    required: ['code'],
    needsProject: false,
    run: getRepairGuide,
  },
]

const inputSchema = ({ args, required }) => ({
  type: 'object',
  properties: Object.fromEntries(args.map((arg) => [arg, ARGUMENT_SCHEMAS[arg]])),
  ...(required.length > 0 && { required }),
  additionalProperties: false,
})

/** The tools as listed to a client: name, short description and an input schema (a hint only). */
export const TOOLS = DEFINITIONS.map((definition) => ({
  name: definition.name,
  description: DESCRIPTIONS[definition.name],
  inputSchema: inputSchema(definition),
}))

const TOOL_NAMES = DEFINITIONS.map(({ name }) => name)

const unknownTool = (name) =>
  problem('CMD_TOOL_UNKNOWN', {
    params: { tool: nameLabel(name), tools: TOOL_NAMES.join(', ') },
    untrusted: { tool: name },
  })

const runTool = (session, name, args, deps) => {
  const definition = DEFINITIONS.find((candidate) => candidate.name === name)
  if (!definition) return reject(session, name, [unknownTool(name)])
  if (!definition.checksOwnArgs) {
    const badArgs = checkArgs(name, definition, args)
    if (badArgs.length > 0) return reject(session, name, badArgs)
  }
  if (definition.needsProject && session.project === null) {
    return reject(session, name, [problem('CMD_NO_PROJECT')])
  }
  return definition.run(session, args, deps)
}

const toToolResult = ({ ok, problems, summary, ...rest }) => ({
  isError: !ok,
  content: {
    ok,
    problems: problems.slice(0, MAX_PROBLEMS),
    total: problems.length,
    summary,
    ...rest,
  },
})

/**
 * The MCP tool result for a host result: the content as JSON text and as structured content.
 * @param {{ isError: boolean, content: object }} result
 */
export const toCallResult = ({ isError, content }) => ({
  content: [{ type: 'text', text: JSON.stringify(content) }],
  structuredContent: content,
  isError,
})

/**
 * The tool host: holds the editing session between calls and runs one tool at a time.
 * `callTool(name, args)` always resolves to `{ isError, content: { ok, problems, total, summary,
 * ... } }`; a bad tool name or bad arguments are problems in the result, not errors. `log(line)` is
 * called once for each applied command, and for nothing else.
 * `guides` maps each catalog code to its repair guide text.
 * @param {{ store: object, now: () => Date, newId: () => string, log: (line: string) => void, guides: Record<string, string> }} deps
 */
export const createToolHost = ({ store, now, newId, log, guides }) => {
  // The one mutable holder: the session value, replaced (never edited) after each call. Calls are
  // chained, so a call that awaits the store never sees a session another call has since replaced.
  let session = EMPTY_SESSION
  let callChain = Promise.resolve()

  // The call has been applied by now; a log that throws must not fail it.
  const writeLog = (line) => {
    try {
      log(line)
    } catch {
      // There is nothing else to do with a log that cannot be written.
    }
  }

  // Any unexpected throw (a store that fails in a way it should not) becomes a problem in the
  // result and leaves the session as it was, so one failed call never ends the calls after it.
  const execute = async (name, args) => {
    try {
      const outcome = await runTool(session, name, args, { store, now, newId, guides })
      session = outcome.session
      if (outcome.applied) writeLog(`${name}: ${escapeControls(outcome.result.summary)}`)
      return toToolResult(outcome.result)
    } catch {
      return toToolResult(reject(session, name, [problem('CMD_INTERNAL_ERROR')]).result)
    }
  }

  const callTool = (name, args = {}) => {
    const call = callChain.then(() => execute(name, args))
    callChain = call
    return call
  }

  return { callTool }
}
