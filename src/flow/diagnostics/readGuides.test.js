import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { readGuides } from './readGuides.js'

// The real file system, except that a test can make one readdirSync call list names in a set order.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, readdirSync: vi.fn(actual.readdirSync) }
})

// A folder that holds `files` ({ name: text }) and is removed when the test ends.
const makeFolder = (files) => {
  const folder = mkdtempSync(join(tmpdir(), 'guides-'))
  onTestFinished(() => rmSync(folder, { recursive: true, force: true }))
  Object.entries(files).forEach(([name, text]) => writeFileSync(join(folder, name), text))
  return folder
}

// Every module a source text imports: `from 'x'`, a bare `import 'x'`, `import('x')` and
// `require('x')`, with either quote style.
const importedModules = (source) => [
  ...new Set(
    [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g)].map(
      (match) => match[2],
    ),
  ),
]

describe('readGuides', () => {
  it('returns the text of each .md file under its code', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': '# CONN_LOOP: Loop\n' })

    expect(readGuides(folder)).toEqual({ CONN_LOOP: '# CONN_LOOP: Loop\n' })
  })

  it('lists only .md files', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': 'a', 'notes.txt': 'b', 'CONN_SELF.md.bak': 'c' })

    expect(Object.keys(readGuides(folder))).toEqual(['CONN_LOOP'])
  })

  it('returns the codes sorted, whatever order the folder lists its files in', () => {
    const folder = makeFolder({
      'STEP_B.md': 'b',
      'CONN_A.md': 'a',
      'FILE_C.md': 'c',
      'CONN_B.md': 'd',
    })
    // Some file systems list names sorted already, so force an unsorted listing.
    vi.mocked(readdirSync).mockReturnValueOnce(['STEP_B.md', 'CONN_A.md', 'FILE_C.md', 'CONN_B.md'])

    expect(Object.keys(readGuides(folder))).toEqual(['CONN_A', 'CONN_B', 'FILE_C', 'STEP_B'])
  })

  it('reads a folder given as a URL', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': 'a' })

    expect(readGuides(new URL(`${pathToFileURL(folder).href}/`))).toEqual({ CONN_LOOP: 'a' })
  })

  it('imports only node:fs and node:path', () => {
    const source = readFileSync(new URL('./readGuides.js', import.meta.url), 'utf8')

    expect(importedModules(source).toSorted()).toEqual(['node:fs', 'node:path'])
  })

  it('sees an import in any form', () => {
    const source = [
      "import { a } from 'node:fs'",
      'import { b } from "node:path"',
      "import 'side-effect'",
      "const c = await import('dynamic')",
      "const d = require('legacy')",
    ].join('\n')

    expect(importedModules(source).toSorted()).toEqual([
      'dynamic',
      'legacy',
      'node:fs',
      'node:path',
      'side-effect',
    ])
  })
})
