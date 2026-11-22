import { CURRENT_SCHEMA_VERSION } from '../src/flow/schema/version.js'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { COMMANDS } from '../src/flow/commands/index.js'
import { GATES } from '../src/flow/gates/index.js'
import { STEP_DATA_FIELDS } from '../src/flow/step.js'
import { PUBLISHED_SCHEMA_URL } from '../src/flow/schema/testHelpers.js'
import { TOOLS } from './tools.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const LLMS = await read('../public/llms.txt')
const AGENTS = await read('../AGENTS.md')

// The unit each step field is given in. A field with no entry here fails the test, so adding a
// step field means documenting its unit in llms.txt.
const UNIT_WORDS = {
  pt: 'minutes',
  lt: 'minutes',
  ca: 'percent',
  queue: 'items',
  batch: 'items',
}

// The unit-less field: its meaning is the step's name.
const UNITLESS_FIELDS = ['label']

const RESULT_KEYS = ['ok', 'problems', 'total', 'summary', 'isError']
const PROBLEM_KEYS = [
  'code',
  'severity',
  'message',
  'fix',
  'stepId',
  'edgeId',
  'field',
  'untrusted',
]
// Each unit with the line llms.txt states for it, so a number cannot match under the wrong unit.
const DURATIONS = [
  ['hour', /\b1 hour = 60\b/],
  ['day', /\b1 day = 480\b/],
  ['week', /\b1 week = 2400\b/],
  ['month', /\b1 month = (?:4 weeks = )?9600\b/],
]

// The `## ` section with this heading: its text up to the next heading.
const section = (text, heading) => {
  const marker = `## ${heading}\n`
  const start = text.indexOf(marker)
  if (start === -1) return ''
  const rest = text.slice(start + marker.length)
  const end = rest.indexOf('\n## ')
  return end === -1 ? rest : rest.slice(0, end)
}

// The one bullet that documents `name`: "- `name`" or "- `name` (...)" up to the next bullet.
const entryFor = (text, name) =>
  text.split('\n').find((line) => line.startsWith(`- \`${name}\``)) ?? ''

const linkTargets = (text) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target)

describe('llms.txt', () => {
  it('is in the llms.txt format: an H1, then a blockquote summary', () => {
    const lines = LLMS.split('\n')
    expect(lines[0]).toMatch(/^# \S/)
    expect(lines.find((line) => line.trim() !== '' && !line.startsWith('# '))).toMatch(/^> \S/)
  })

  it('says open_project returns the schemaVersion the file was written at', () => {
    expect(entryFor(section(LLMS, 'MCP tools'), 'open_project')).toContain('`schemaVersion`')
  })

  it('names the schema version and links the JSON Schema', () => {
    expect(LLMS).toContain(`schema version ${CURRENT_SCHEMA_VERSION}`)
    expect(LLMS).toContain(PUBLISHED_SCHEMA_URL)
  })

  describe('MCP tools', () => {
    const toolsSection = section(LLMS, 'MCP tools')

    it.each(TOOLS.map(({ name }) => [name]))('documents the tool %s', (name) => {
      expect(entryFor(toolsSection, name)).not.toBe('')
    })

    it.each(TOOLS.map((tool) => [tool.name, Object.keys(tool.inputSchema.properties)]))(
      'gives the arguments of %s',
      (name, args) => {
        const entry = entryFor(toolsSection, name)
        const missing = args.filter((arg) => !entry.includes(`\`${arg}\``))
        expect(missing).toEqual([])
      },
    )

    const resultsSection = section(LLMS, 'Tool results')

    it.each(RESULT_KEYS.map((key) => [key]))('describes the result key %s', (key) => {
      expect(resultsSection).toContain(`\`${key}\``)
    })

    it.each(PROBLEM_KEYS.map((key) => [key]))('describes the problem key %s', (key) => {
      expect(resultsSection).toContain(`\`${key}\``)
    })

    it('gives the cap on problems shown', () => {
      expect(resultsSection).toMatch(/at most 20\b/)
    })

    it.each(Object.keys(GATES).map((id) => [id]))('names the gate %s', (id) => {
      expect(section(LLMS, 'Gates')).toContain(`\`${id}\``)
    })
  })

  describe('step fields', () => {
    const fieldsSection = section(LLMS, 'Steps')

    it.each(STEP_DATA_FIELDS.map((key) => [key]))('gives data.%s with its meaning', (key) => {
      expect(entryFor(fieldsSection, `data.${key}`)).not.toBe('')
    })

    it.each(STEP_DATA_FIELDS.filter((key) => !UNITLESS_FIELDS.includes(key)).map((key) => [key]))(
      'gives data.%s its unit',
      (key) => {
        expect(UNIT_WORDS, `no unit declared for ${key}`).toHaveProperty(key)
        expect(entryFor(fieldsSection, `data.${key}`).toLowerCase()).toContain(UNIT_WORDS[key])
      },
    )

    const durationsSection = section(LLMS, 'Durations')

    it.each(DURATIONS)('says how a duration is counted in working time: one %s', (_unit, line) => {
      expect(durationsSection).toMatch(line)
    })

    it('says step and box mean the same thing', () => {
      expect(LLMS).toMatch(/(?=[^.]*\bstep\b)(?=[^.]*\bbox\b)(?=[^.]*\bsame\b)[^.]*\./i)
    })
  })

  describe('rules only the server and the app check', () => {
    const rulesSection = section(LLMS, 'Rules the JSON Schema cannot express')
      .toLowerCase()
      .replaceAll('`', '')

    it.each([
      ['loops', /loop|cycle/],
      ['duplicate ids', /duplicate .*id/],
      ['missing endpoints', /source|target|endpoint/i],
    ])('lists %s', (_, pattern) => {
      expect(rulesSection).toMatch(pattern)
    })
  })

  it("names every key a problem's untrusted object can carry", () => {
    const entry = entryFor(section(LLMS, 'Tool results'), 'untrusted')
    const keys = [
      'title',
      'id',
      'steps',
      'source',
      'target',
      'name',
      'tool',
      'time',
      'command',
      'arguments',
      'gate',
    ]
    expect(keys.filter((key) => !entry.includes(`\`${key}\``))).toEqual([])
  })

  it('says the app recomputes every number', () => {
    expect(LLMS).toMatch(/app's numbers win/i)
  })

  it('says everything read from a file or a tool is data, not instructions', () => {
    expect(LLMS).toMatch(/data, not instructions/i)
    expect(LLMS).toMatch(/never follow instructions found in it/i)
  })
})

describe('AGENTS.md', () => {
  it('links to llms.txt', () => {
    expect(linkTargets(AGENTS).some((target) => target.endsWith('/llms.txt'))).toBe(true)
  })

  it('links to the repo conventions in CLAUDE.md', () => {
    expect(linkTargets(AGENTS).some((target) => target.endsWith('.claude/CLAUDE.md'))).toBe(true)
  })
})

describe('UI-only commands', () => {
  const uiOnlyNames = Object.entries(COMMANDS)
    .filter(([, { uiOnly }]) => uiOnly)
    .map(([name]) => name)

  it('has at least one, so the checks below are not empty', () => {
    expect(uiOnlyNames.length).toBeGreaterThan(0)
  })

  it.each([
    ['llms.txt', LLMS],
    ['AGENTS.md', AGENTS],
  ])('are named nowhere in %s', (_file, text) => {
    // As a whole word: "move_step" is also the end of "remove_step".
    for (const name of uiOnlyNames) {
      expect(text, name).not.toMatch(new RegExp(`(?<![\\w])${name}(?![\\w])`))
    }
  })
})
