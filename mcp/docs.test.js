import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { GATES } from '../src/flow/gates/index.js'
import { STEP_DATA_FIELDS } from '../src/flow/step.js'
import { TOOLS } from './tools.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const LLMS = await read('../public/llms.txt')
const AGENTS = await read('../AGENTS.md')

const SCHEMA_URL = 'https://bailejl.github.io/ai-enabler/schema/project-0.1.0.json'

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

// The `## ` section with this heading: its text up to the next heading.
const section = (text, heading) => {
  const start = text.indexOf(`## ${heading}\n`)
  if (start === -1) return ''
  const rest = text.slice(start + heading.length + 4)
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

  it('names the schema version and links the JSON Schema', () => {
    expect(LLMS).toContain('0.1.0')
    expect(LLMS).toContain(SCHEMA_URL)
  })

  describe('MCP tools', () => {
    const tools = section(LLMS, 'MCP tools')

    it.each(TOOLS.map(({ name }) => [name]))('documents the tool %s', (name) => {
      expect(entryFor(tools, name)).not.toBe('')
    })

    it.each(TOOLS.map((tool) => [tool.name, Object.keys(tool.inputSchema.properties)]))(
      'gives the arguments of %s',
      (name, args) => {
        const entry = entryFor(tools, name)
        args.forEach((arg) => expect(entry).toContain(`\`${arg}\``))
      },
    )

    it('describes the result shape and the rejection flag', () => {
      const text = section(LLMS, 'Tool results')
      ;['ok', 'problems', 'total', 'summary', 'isError'].forEach((key) =>
        expect(text).toContain(`\`${key}\``),
      )
      expect(text).toContain('20')
      ;['code', 'severity', 'message', 'fix', 'stepId', 'edgeId', 'field', 'untrusted'].forEach(
        (key) => expect(text).toContain(`\`${key}\``),
      )
    })

    it.each(Object.keys(GATES).map((id) => [id]))('names the gate %s', (id) => {
      expect(section(LLMS, 'Gates')).toContain(`\`${id}\``)
    })
  })

  describe('step fields', () => {
    const fields = section(LLMS, 'Steps')

    it.each(STEP_DATA_FIELDS.map((key) => [key]))('gives data.%s with its meaning', (key) => {
      const entry = entryFor(fields, `data.${key}`)
      expect(entry).not.toBe('')
      if (!UNITLESS_FIELDS.includes(key)) {
        expect(UNIT_WORDS, `no unit declared for ${key}`).toHaveProperty(key)
        expect(entry.toLowerCase()).toContain(UNIT_WORDS[key])
      }
    })

    it('says how a duration is counted in working time', () => {
      const text = section(LLMS, 'Durations')
      ;['60', '480', '2400', '9600'].forEach((minutes) => expect(text).toContain(minutes))
    })

    it('says step and box mean the same thing', () => {
      expect(LLMS).toMatch(/step and box mean the same thing/i)
    })
  })

  describe('rules only the server and the app check', () => {
    const rules = section(LLMS, 'Rules the JSON Schema cannot express')
      .toLowerCase()
      .replaceAll('`', '')

    it.each([
      ['loops', /loop|cycle/],
      ['duplicate ids', /duplicate .*id/],
      ['missing endpoints', /source or target/],
    ])('lists %s', (_, pattern) => {
      expect(rules).toMatch(pattern)
    })
  })

  it('says the app recomputes every number', () => {
    expect(LLMS).toMatch(/app's numbers win/i)
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
