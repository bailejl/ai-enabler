import { describe, expect, test } from 'vitest'
import { findStaleArtifacts, staleMessage } from './plugin-bundle-check.js'

const SERVER = 'plugin/server/aie-mcp.js'
const SCHEMA = 'plugin/schema/project-0.1.0.json'

const built = { [SERVER]: 'export const server = 1\n', [SCHEMA]: '{"type":"object"}\n' }

describe('findStaleArtifacts', () => {
  test('a fresh build passes: nothing is stale', () => {
    expect(findStaleArtifacts({ built, committed: { ...built } })).toEqual([])
  })

  test.each([
    ['the bundled server', SERVER],
    ["the plugin's copy of the JSON Schema", SCHEMA],
  ])('names %s when it differs from the build', (_label, artifact) => {
    const committed = { ...built, [artifact]: 'edited by hand\n' }
    expect(findStaleArtifacts({ built, committed })).toEqual([artifact])
  })

  test('names every stale artifact, not just the first', () => {
    const committed = { [SERVER]: 'old', [SCHEMA]: 'old' }
    expect(findStaleArtifacts({ built, committed })).toEqual([SERVER, SCHEMA])
  })

  test('a committed artifact that is missing is stale', () => {
    expect(findStaleArtifacts({ built, committed: { [SCHEMA]: built[SCHEMA] } })).toEqual([SERVER])
  })

  test('compares bytes, so a one-character difference is stale', () => {
    const committed = { ...built, [SERVER]: `${built[SERVER]} ` }
    expect(findStaleArtifacts({ built, committed })).toEqual([SERVER])
  })

  test('string and Buffer content with the same bytes are equal', () => {
    const committed = { [SERVER]: Buffer.from(built[SERVER]), [SCHEMA]: Buffer.from(built[SCHEMA]) }
    expect(findStaleArtifacts({ built, committed })).toEqual([])
  })
})

describe('staleMessage', () => {
  test('names each stale file and says to run npm run build:plugin', () => {
    const message = staleMessage([SERVER, SCHEMA])
    expect(message).toContain(SERVER)
    expect(message).toContain(SCHEMA)
    expect(message).toContain('npm run build:plugin')
  })
})
