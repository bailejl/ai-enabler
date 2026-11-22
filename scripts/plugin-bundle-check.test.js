import { describe, expect, test } from 'vitest'
import { checkBundle } from './plugin-bundle-check.js'

const PLUGIN_SERVER = 'plugin/server/aie-mcp.js'
const PLUGIN_SCHEMA = 'plugin/schema/project-0.1.0.json'

const built = {
  [PLUGIN_SERVER]: 'export const server = 1\n',
  [PLUGIN_SCHEMA]: '{"type":"object"}\n',
}

describe('checkBundle', () => {
  test('a fresh build passes', () => {
    expect(checkBundle({ built, committed: { ...built } })).toEqual({
      ok: true,
      message: 'Plugin bundle is up to date.',
    })
  })

  test('a stale server fails, names the server only, and says to run npm run build:plugin', () => {
    const { ok, message } = checkBundle({ built, committed: { ...built, [PLUGIN_SERVER]: 'old' } })

    expect(ok).toBe(false)
    expect(message).toContain(PLUGIN_SERVER)
    expect(message).not.toContain(PLUGIN_SCHEMA)
    expect(message).toContain('npm run build:plugin')
  })

  test('a stale copy of the JSON Schema fails and names the schema only', () => {
    const { ok, message } = checkBundle({ built, committed: { ...built, [PLUGIN_SCHEMA]: 'old' } })

    expect(ok).toBe(false)
    expect(message).toContain(PLUGIN_SCHEMA)
    expect(message).not.toContain(PLUGIN_SERVER)
    expect(message).toContain('npm run build:plugin')
  })

  test('both stale: names both artifacts, not just the first', () => {
    const { ok, message } = checkBundle({
      built,
      committed: { [PLUGIN_SERVER]: 'old', [PLUGIN_SCHEMA]: 'old' },
    })

    expect(ok).toBe(false)
    expect(message).toContain(PLUGIN_SERVER)
    expect(message).toContain(PLUGIN_SCHEMA)
    expect(message).toContain('npm run build:plugin')
  })

  test('the stale message puts the heading, each artifact and the fix on their own lines', () => {
    const { message } = checkBundle({
      built,
      committed: { [PLUGIN_SERVER]: 'old', [PLUGIN_SCHEMA]: 'old' },
    })

    expect(message.split('\n')).toEqual([
      'The plugin build is out of date:',
      `  ${PLUGIN_SERVER}`,
      `  ${PLUGIN_SCHEMA}`,
      'Run `npm run build:plugin` and commit the result.',
    ])
  })

  test('a committed artifact that is missing is stale', () => {
    const { ok, message } = checkBundle({
      built,
      committed: { [PLUGIN_SCHEMA]: built[PLUGIN_SCHEMA] },
    })

    expect(ok).toBe(false)
    expect(message).toContain(PLUGIN_SERVER)
  })

  test('compares bytes, so a one-character difference is stale', () => {
    const committed = { ...built, [PLUGIN_SERVER]: `${built[PLUGIN_SERVER]} ` }

    expect(checkBundle({ built, committed }).ok).toBe(false)
  })

  test('string and Buffer content with the same bytes are equal', () => {
    const committed = {
      [PLUGIN_SERVER]: Buffer.from(built[PLUGIN_SERVER]),
      [PLUGIN_SCHEMA]: Buffer.from(built[PLUGIN_SCHEMA]),
    }

    expect(checkBundle({ built, committed }).ok).toBe(true)
  })

  test('a committed file the build did not produce is stale, and is named', () => {
    const extra = 'plugin/schema/project-0.0.1.json'
    const { ok, message } = checkBundle({ built, committed: { ...built, [extra]: '{}' } })

    expect(ok).toBe(false)
    expect(message.split('\n')).toEqual([
      'The plugin build is out of date:',
      `  ${extra}`,
      'Run `npm run build:plugin` and commit the result.',
    ])
  })

  test('lists a stale built artifact before an extra committed file', () => {
    const extra = 'plugin/schema/old.json'
    const { message } = checkBundle({
      built,
      committed: { ...built, [PLUGIN_SERVER]: 'old', [extra]: '{}' },
    })

    expect(message.split('\n').slice(1, -1)).toEqual([`  ${PLUGIN_SERVER}`, `  ${extra}`])
  })

  test('a build that produced no artifacts fails rather than passing vacuously', () => {
    const { ok, message } = checkBundle({ built: {}, committed: built })

    expect(ok).toBe(false)
    expect(message).toMatch(/no artifacts/)
  })
})
