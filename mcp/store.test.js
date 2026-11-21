import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStore } from './store.js'

// Layout per test: <tmp>/start/projects is the projects folder, <tmp>/start/secret.json sits next
// to it, and <tmp>/outside holds files the store must never read or change.
let tmp
let startDir
let folder
let outside

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'aie-store-'))
  startDir = path.join(tmp, 'start')
  folder = path.join(startDir, 'projects')
  outside = path.join(tmp, 'outside')
  await mkdir(folder, { recursive: true })
  await mkdir(outside)
  await writeFile(path.join(startDir, 'secret.json'), 'start secret')
  await writeFile(path.join(outside, 'secret.json'), 'outside secret')
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

// Everything under `dir` as path -> content (or "-> target" for a symlink), so a test can assert
// that a call changed nothing.
const snapshot = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) return { [full]: `-> ${await readlink(full)}` }
      if (entry.isDirectory()) return snapshot(full)
      return { [full]: await readFile(full, 'utf8') }
    }),
  )
  return Object.assign({}, ...parts)
}

const REJECTED_NAMES = [
  '../secret.json',
  '..',
  'a/b.json',
  'a\\b.json',
  '/etc/passwd',
  '',
  'notes.txt',
  'link-out.json',
]

describe('names outside the projects folder', () => {
  beforeEach(async () => {
    await symlink(path.join(outside, 'secret.json'), path.join(folder, 'link-out.json'))
  })

  it.each(REJECTED_NAMES)('rejects %j for read', async (name) => {
    const before = await snapshot(tmp)
    const result = await createStore(startDir).read(name)
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(result).not.toHaveProperty('text')
    expect(await snapshot(tmp)).toEqual(before)
  })

  it.each(REJECTED_NAMES)('rejects %j for write', async (name) => {
    const before = await snapshot(tmp)
    const result = await createStore(startDir).write(name, 'overwritten')
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(await snapshot(tmp)).toEqual(before)
  })

  it.each(REJECTED_NAMES)('rejects %j for a new project', async (name) => {
    const before = await snapshot(tmp)
    const result = await createStore(startDir).write(name, 'overwritten', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('keeps the raw name in untrusted only', async () => {
    const result = await createStore(startDir).read('../secret.json')
    const [found] = result.problems
    expect(found.untrusted).toEqual({ name: '../secret.json' })
    expect(JSON.stringify({ ...found, untrusted: undefined })).not.toContain('secret')
  })
})

describe('what counts as a name', () => {
  const NOT_ALLOWED = [
    undefined,
    null,
    5,
    ['team.json'],
    { toString: () => 'team.json' },
    'team\0.json',
    'team.json\0',
    'team.json\n',
    'team.json ',
    '.json',
    '.hidden.json',
    '-team.json',
    '_team.json',
    'team.JSON',
    'team.json.txt',
    'team',
    'te am.json',
    '..json/../a.json',
  ]

  it.each(NOT_ALLOWED)('rejects %j for read and write', async (name) => {
    const store = createStore(startDir)
    const before = await snapshot(tmp)
    expect((await store.read(name)).problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect((await store.write(name, 'x')).problems.map((p) => p.code)).toEqual([
      'FILE_NAME_NOT_ALLOWED',
    ])
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('leaves untrusted off when the name is not text', async () => {
    const result = await createStore(startDir).read(5)
    expect(result.problems[0]).not.toHaveProperty('untrusted')
  })

  it.each(['team.json', '1.json', 'a.b-c_d.json', 'Team.v2.json', 'a..json'])(
    'accepts %j',
    async (name) => {
      const store = createStore(startDir)
      expect(await store.write(name, 'text')).toEqual({ ok: true })
      expect(await store.read(name)).toEqual({ ok: true, text: 'text' })
    },
  )
})

describe('read', () => {
  it('returns the file text unchanged', async () => {
    const text = '{"a":"é ✓"}\n'
    await writeFile(path.join(folder, 'team.json'), text)
    expect(await createStore(startDir).read('team.json')).toEqual({ ok: true, text })
  })

  it('reports a missing file as FILE_NOT_FOUND with the name in untrusted', async () => {
    const result = await createStore(startDir).read('missing.json')
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
    expect(result.problems[0].untrusted).toEqual({ name: 'missing.json' })
  })

  it('reports a missing projects folder as FILE_NOT_FOUND and does not create it', async () => {
    await rm(folder, { recursive: true })
    const result = await createStore(startDir).read('team.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
    await expect(lstat(folder)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports a missing start directory as FILE_NOT_FOUND', async () => {
    const result = await createStore(path.join(tmp, 'nowhere')).read('team.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
  })

  it('reports a name too long for the file system as FILE_NOT_FOUND', async () => {
    const result = await createStore(startDir).read(`${'a'.repeat(300)}.json`)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
  })

  it('reports a directory named like a project as FILE_NOT_FOUND', async () => {
    await mkdir(path.join(folder, 'dir.json'))
    const result = await createStore(startDir).read('dir.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
  })

  it('rejects a symlink to a file inside the folder too', async () => {
    await writeFile(path.join(folder, 'real.json'), 'real')
    await symlink(path.join(folder, 'real.json'), path.join(folder, 'alias.json'))
    const result = await createStore(startDir).read('alias.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it('does not read through a dangling symlink', async () => {
    await symlink(path.join(outside, 'nothing.json'), path.join(folder, 'dangling.json'))
    const result = await createStore(startDir).read('dangling.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it('resolves a start directory given through a symlink', async () => {
    await writeFile(path.join(folder, 'team.json'), 'via alias')
    const alias = path.join(tmp, 'alias')
    await symlink(startDir, alias)
    expect(await createStore(alias).read('team.json')).toEqual({ ok: true, text: 'via alias' })
  })

  it('resolves a relative start directory against the working directory', async () => {
    await writeFile(path.join(folder, 'team.json'), 'relative')
    const store = createStore(path.relative(process.cwd(), startDir))
    expect(await store.read('team.json')).toEqual({ ok: true, text: 'relative' })
  })
})

describe('a projects folder that is a link', () => {
  beforeEach(async () => {
    await rm(folder, { recursive: true })
    await writeFile(path.join(outside, 'team.json'), 'outside team')
    await symlink(outside, folder)
  })

  it('reads nothing through it', async () => {
    const result = await createStore(startDir).read('team.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
    expect(result).not.toHaveProperty('text')
  })

  it('writes nothing through it', async () => {
    const before = await snapshot(outside)
    const store = createStore(startDir)
    expect((await store.write('team.json', 'changed')).problems.map((p) => p.code)).toEqual([
      'FILE_SAVE_FAILED',
    ])
    expect(
      (await store.write('new.json', 'x', { mustBeNew: true })).problems.map((p) => p.code),
    ).toEqual(['FILE_SAVE_FAILED'])
    expect(await snapshot(outside)).toEqual(before)
  })

  it('writes nothing through a dangling one, and does not call it a taken name', async () => {
    await rm(folder)
    await symlink(path.join(outside, 'not-there'), folder)
    const result = await createStore(startDir).write('new.json', 'x', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    await expect(lstat(path.join(outside, 'not-there'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('write', () => {
  it('writes the text and replaces an existing file', async () => {
    const store = createStore(startDir)
    expect(await store.write('team.json', 'first')).toEqual({ ok: true })
    expect(await store.write('team.json', 'second')).toEqual({ ok: true })
    expect(await readFile(path.join(folder, 'team.json'), 'utf8')).toBe('second')
  })

  it('writes a new project when the name is free', async () => {
    const store = createStore(startDir)
    expect(await store.write('first.json', 'new', { mustBeNew: true })).toEqual({ ok: true })
    expect(await readFile(path.join(folder, 'first.json'), 'utf8')).toBe('new')
  })

  it('creates the projects folder on save', async () => {
    await rm(folder, { recursive: true })
    expect(await createStore(startDir).write('first.json', 'new', { mustBeNew: true })).toEqual({
      ok: true,
    })
    expect(await readFile(path.join(folder, 'first.json'), 'utf8')).toBe('new')
  })

  it('creates a missing start directory too', async () => {
    const fresh = path.join(tmp, 'a', 'b')
    expect(await createStore(fresh).write('first.json', 'new')).toEqual({ ok: true })
    expect(await readFile(path.join(fresh, 'projects', 'first.json'), 'utf8')).toBe('new')
  })

  it('does not create the folder for a rejected name', async () => {
    await rm(folder, { recursive: true })
    await createStore(startDir).write('../x.json', 'x')
    await expect(lstat(folder)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses a new project over an existing file and leaves it unchanged', async () => {
    await writeFile(path.join(folder, 'team.json'), 'existing')
    const before = await snapshot(tmp)
    const result = await createStore(startDir).write('team.json', 'new', { mustBeNew: true })
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_TAKEN'])
    expect(result.problems[0].untrusted).toEqual({ name: 'team.json' })
    expect(result.problems[0].fix).toMatch(/another name/)
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('refuses to write through a symlink that points outside', async () => {
    await symlink(path.join(outside, 'secret.json'), path.join(folder, 'link-out.json'))
    const before = await snapshot(tmp)
    const result = await createStore(startDir).write('link-out.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('refuses to create a file through a dangling symlink', async () => {
    await symlink(path.join(outside, 'created.json'), path.join(folder, 'dangling.json'))
    const result = await createStore(startDir).write('dangling.json', 'x', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    await expect(lstat(path.join(outside, 'created.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('reports a directory in the way as FILE_SAVE_FAILED', async () => {
    await mkdir(path.join(folder, 'dir.json'))
    const result = await createStore(startDir).write('dir.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
  })

  it('reports a name too long for the file system as FILE_SAVE_FAILED', async () => {
    const result = await createStore(startDir).write(`${'a'.repeat(300)}.json`, 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
  })

  it('reports other failures of a new project as FILE_SAVE_FAILED, not a taken name', async () => {
    const store = createStore(startDir)
    const tooLong = await store.write(`${'a'.repeat(300)}.json`, 'x', { mustBeNew: true })
    expect(tooLong.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    const notADirectory = createStore(path.join(startDir, 'secret.json'))
    const result = await notADirectory.write('a.json', 'x', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
  })

  it('reports a start directory that is a file as FILE_SAVE_FAILED', async () => {
    const result = await createStore(path.join(startDir, 'secret.json')).write('a.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
  })

  const canChmod = process.platform !== 'win32' && process.getuid?.() !== 0

  it.skipIf(!canChmod)('reports an unwritable folder as FILE_SAVE_FAILED', async () => {
    await chmod(folder, 0o500)
    try {
      const result = await createStore(startDir).write('first.json', 'x')
      expect(result.ok).toBe(false)
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expect(result.problems[0].untrusted).toEqual({ name: 'first.json' })
    } finally {
      await chmod(folder, 0o700)
    }
    expect(await readdir(folder)).toEqual([])
  })

  it.skipIf(!canChmod)('reports an unwritable file as FILE_SAVE_FAILED', async () => {
    const file = path.join(folder, 'team.json')
    await writeFile(file, 'kept')
    await chmod(file, 0o400)
    const result = await createStore(startDir).write('team.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    expect(await readFile(file, 'utf8')).toBe('kept')
  })
})
