import { describe, it, expect } from 'vitest'
import { COMMANDS, isToolCommand } from '../commands/index.js'
import projectSchema from '../../../public/schema/project-0.1.0.json'

// Only MCP commands count: a UI-only command (flagged `uiOnly`) is not a tool, so a client cannot
// use it to set a field.
const MCP_COMMANDS = Object.fromEntries(Object.entries(COMMANDS).filter(isToolCommand))

// True when the "command.argument" reference names an argument of a command in `commands`.
const hasArgument = (commands, ref) => {
  const [command, argument] = ref.split('.')
  return commands[command]?.args.includes(argument) ?? false
}

// The JSON path of every leaf the schema describes, as `a.b` and `list[].c`. Walks `properties` and
// array `items`. A `const` leaf holds one fixed value, so nobody writes it: ASSUMPTION, it covers
// schemaVersion and a node's `type: "step"`.
const writablePaths = (schema, path = '') => {
  if (schema.const !== undefined) return []
  if (schema.properties) {
    return Object.entries(schema.properties).flatMap(([key, child]) =>
      writablePaths(child, path === '' ? key : `${path}.${key}`),
    )
  }
  if (schema.items) return writablePaths(schema.items, `${path}[]`)
  return [path]
}

// The paths no command sets, given the command arguments each path maps to. A path under an
// exempt prefix needs no command. A mapped argument that is not in the table counts as unmapped.
const pathsWithoutCommand = (schema, { exempt, mapping, commands }) => {
  const isExempt = (path) =>
    exempt.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))
  const isSet = (path) => (mapping[path] ?? []).some((ref) => hasArgument(commands, ref))
  return writablePaths(schema).filter((path) => !isExempt(path) && !isSet(path))
}

// The three kinds of exemption in the plan: server-written fields, ids and positions.
const EXEMPT = [
  'schemaVersion',
  'contentHash',
  'exportedAt',
  'modifiedBy',
  'project.id',
  'nodes[].id',
  'edges[].id',
  'nodes[].position',
]

const STEP_METRICS = ['pt', 'lt', 'ca', 'queue', 'batch']

// Path -> the command arguments that set it.
const MAPPING = {
  'project.name': ['create_project.name'],
  'nodes[].data.label': ['add_step.name', 'update_step.name'],
  ...Object.fromEntries(
    STEP_METRICS.map((field) => [
      `nodes[].data.${field}`,
      [`add_step.${field}`, `set_step_metrics.${field}`],
    ]),
  ),
  'edges[].source': ['connect.sourceId'],
  'edges[].target': ['connect.targetId'],
}

const options = { exempt: EXEMPT, mapping: MAPPING, commands: MCP_COMMANDS }

// AC23: every writable field in the save-file JSON Schema can be set by some command.
describe('save-file parity', () => {
  it('has a command argument for every writable path in the JSON Schema', () => {
    expect(pathsWithoutCommand(projectSchema, options)).toEqual([])
  })

  it('treats a const field as not writable', () => {
    expect(writablePaths(projectSchema)).not.toContain('nodes[].type')
    expect(writablePaths(projectSchema)).not.toContain('schemaVersion')
  })

  it.each(Object.entries(MAPPING).flatMap(([path, refs]) => refs.map((ref) => [path, ref])))(
    'maps %s to %s, which exists in the command table',
    (_path, ref) => {
      expect(hasArgument(MCP_COMMANDS, ref)).toBe(true)
    },
  )

  it('maps only paths the JSON Schema has', () => {
    expect(
      Object.keys(MAPPING).filter((path) => !writablePaths(projectSchema).includes(path)),
    ).toEqual([])
  })

  it('fails and names a step field no command sets', () => {
    const withExtraField = structuredClone(projectSchema)
    withExtraField.properties.nodes.items.properties.data.properties.cost = { type: 'number' }
    const missing = pathsWithoutCommand(withExtraField, options)
    expect(missing).toHaveLength(1)
    expect(missing[0]).toContain('cost')
  })

  it('fails and names a field whose mapped argument is not in the command table', () => {
    const mapping = { ...MAPPING, 'project.name': ['create_project.title'] }
    expect(pathsWithoutCommand(projectSchema, { ...options, mapping })).toEqual(['project.name'])
  })

  describe('with a UI-only command', () => {
    const MOVE = { 'nodes[].position.x': ['move_step.x'], 'nodes[].position.y': ['move_step.y'] }
    const withoutPositionExemption = EXEMPT.filter((prefix) => prefix !== 'nodes[].position')

    it('has a UI-only command to check against', () => {
      expect(COMMANDS.move_step.uiOnly).toBe(true)
      expect(COMMANDS.move_step.args).toEqual(['stepId', 'x', 'y'])
    })

    it('does not count it as a command that sets a field', () => {
      const missing = pathsWithoutCommand(projectSchema, {
        exempt: withoutPositionExemption,
        mapping: { ...MAPPING, ...MOVE },
        commands: MCP_COMMANDS,
      })
      expect(missing).toEqual(['nodes[].position.x', 'nodes[].position.y'])
    })

    it('does not count a mapping to it as an argument in the command table', () => {
      expect(hasArgument(COMMANDS, 'move_step.x')).toBe(true)
      expect(hasArgument(MCP_COMMANDS, 'move_step.x')).toBe(false)
    })
  })
})
