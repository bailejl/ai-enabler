import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { readBundleFiles } from './plugin-bundle-files.js'

let base

const write = (name, content) => {
  mkdirSync(path.dirname(path.join(base, name)), { recursive: true })
  writeFileSync(path.join(base, name), content)
}

beforeEach(() => {
  base = mkdtempSync(path.join(tmpdir(), 'aie-bundle-files-'))
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('readBundleFiles', () => {
  test('reads files from both bundle folders, keyed by repo path with forward slashes', () => {
    write('plugin/server/aie-mcp.js', 'server')
    write('plugin/schema/project-0.1.0.json', '{}')

    const files = readBundleFiles(base)

    expect(Object.keys(files).sort()).toEqual([
      'plugin/schema/project-0.1.0.json',
      'plugin/server/aie-mcp.js',
    ])
    expect(files['plugin/server/aie-mcp.js'].toString()).toBe('server')
    expect(files['plugin/schema/project-0.1.0.json'].toString()).toBe('{}')
  })

  test('walks nested folders', () => {
    write('plugin/server/deep/er/chunk.js', 'nested')

    expect(Object.keys(readBundleFiles(base))).toEqual(['plugin/server/deep/er/chunk.js'])
  })

  test('ignores files outside the bundle folders', () => {
    write('plugin/skills/aie-guide/SKILL.md', 'skill')
    write('plugin/server/aie-mcp.js', 'server')

    expect(Object.keys(readBundleFiles(base))).toEqual(['plugin/server/aie-mcp.js'])
  })

  test('a missing folder has no files', () => {
    write('plugin/server/aie-mcp.js', 'server')

    expect(Object.keys(readBundleFiles(base))).toEqual(['plugin/server/aie-mcp.js'])
    expect(readBundleFiles(path.join(base, 'nowhere'))).toEqual({})
  })

  test('rethrows an error that is not a missing folder', () => {
    write('plugin/server', 'a file where a folder should be')

    expect(() => readBundleFiles(base)).toThrow()
  })
})
