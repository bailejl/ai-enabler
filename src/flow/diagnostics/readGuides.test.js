import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { readGuides } from './readGuides.js'

const folders = []

const makeFolder = (files) => {
  const folder = mkdtempSync(join(tmpdir(), 'guides-'))
  folders.push(folder)
  Object.entries(files).forEach(([name, text]) => writeFileSync(join(folder, name), text))
  return folder
}

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

describe('readGuides', () => {
  it('returns the text of each .md file under its code', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': '# CONN_LOOP: Loop\n' })

    expect(readGuides(folder)).toEqual({ CONN_LOOP: '# CONN_LOOP: Loop\n' })
  })

  it('lists only .md files', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': 'a', 'notes.txt': 'b', 'CONN_SELF.md.bak': 'c' })

    expect(Object.keys(readGuides(folder))).toEqual(['CONN_LOOP'])
  })

  it('lists the codes in the same sorted order on every read, whatever order the files were written in', () => {
    const folder = makeFolder({
      'STEP_B.md': 'b',
      'CONN_A.md': 'a',
      'FILE_C.md': 'c',
      'CONN_B.md': 'd',
    })
    const sorted = ['CONN_A', 'CONN_B', 'FILE_C', 'STEP_B']

    expect(Object.keys(readGuides(folder))).toEqual(sorted)
    expect(Object.keys(readGuides(folder))).toEqual(sorted)
  })

  it('reads a folder given as a URL', () => {
    const folder = makeFolder({ 'CONN_LOOP.md': 'a' })

    expect(readGuides(new URL(`${pathToFileURL(folder).href}/`))).toEqual({ CONN_LOOP: 'a' })
  })

  it('imports only node:fs and node:path', () => {
    const source = readFileSync(new URL('./readGuides.js', import.meta.url), 'utf8')
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])

    expect(specifiers.toSorted()).toEqual(['node:fs', 'node:path'])
  })
})
