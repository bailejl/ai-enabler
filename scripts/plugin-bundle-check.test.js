import { describe, expect, test } from 'vitest'
import { checkBundle } from './plugin-bundle-check.js'

const SERVER = 'plugin/server/aie-mcp.js'
const SCHEMA = 'plugin/schema/project-0.1.0.json'

const built = { [SERVER]: 'export const server = 1\n', [SCHEMA]: '{"type":"object"}\n' }

describe('checkBundle', () => {
  test('a fresh build passes', () => {
    expect(checkBundle({ built, committed: { ...built } })).toEqual({
      ok: true,
      message: 'Plugin bundle is up to date.',
    })
  })

  test('a stale server fails, names the server only, and says to run npm run build:plugin', () => {
    const { ok, message } = checkBundle({ built, committed: { ...built, [SERVER]: 'old' } })

    expect(ok).toBe(false)
    expect(message).toContain(SERVER)
    expect(message).not.toContain(SCHEMA)
    expect(message).toContain('npm run build:plugin')
  })

  test('a stale copy of the JSON Schema fails and names the schema only', () => {
    const { ok, message } = checkBundle({ built, committed: { ...built, [SCHEMA]: 'old' } })

    expect(ok).toBe(false)
    expect(message).toContain(SCHEMA)
    expect(message).not.toContain(SERVER)
    expect(message).toContain('npm run build:plugin')
  })

  test('both stale: names both artifacts, not just the first', () => {
    const { ok, message } = checkBundle({ built, committed: { [SERVER]: 'old', [SCHEMA]: 'old' } })

    expect(ok).toBe(false)
    expect(message).toContain(SERVER)
    expect(message).toContain(SCHEMA)
    expect(message).toContain('npm run build:plugin')
  })

  test('a committed artifact that is missing is stale', () => {
    const { ok, message } = checkBundle({ built, committed: { [SCHEMA]: built[SCHEMA] } })

    expect(ok).toBe(false)
    expect(message).toContain(SERVER)
  })

  test('compares bytes, so a one-character difference is stale', () => {
    const committed = { ...built, [SERVER]: `${built[SERVER]} ` }

    expect(checkBundle({ built, committed }).ok).toBe(false)
  })

  test('string and Buffer content with the same bytes are equal', () => {
    const committed = { [SERVER]: Buffer.from(built[SERVER]), [SCHEMA]: Buffer.from(built[SCHEMA]) }

    expect(checkBundle({ built, committed }).ok).toBe(true)
  })

  test('a build that produced no artifacts fails rather than passing vacuously', () => {
    expect(checkBundle({ built: {}, committed: built }).ok).toBe(false)
  })
})
