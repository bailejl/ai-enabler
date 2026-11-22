import { execFile } from 'node:child_process'
import {
  chmod,
  link,
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
import fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  vi.restoreAllMocks()
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

const canChmod = process.platform !== 'win32' && process.getuid?.() !== 0
const canMakePipe = process.platform !== 'win32'

// The raw name is user text, so it may appear in `untrusted` and nowhere else in the problem.
const expectNameOnlyInUntrusted = (found, name) => {
  expect(found.untrusted).toEqual({ name })
  Object.entries(found)
    .filter(([key]) => key !== 'untrusted')
    .forEach(([key, value]) => {
      expect(JSON.stringify(value), `the ${key} field`).not.toContain(name)
    })
}

const MAX_BYTES = 5 * 1024 * 1024

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
    expectNameOnlyInUntrusted(result.problems[0], '../secret.json')
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
    expectNameOnlyInUntrusted(result.problems[0], 'missing.json')
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

  it('rejects a directory named like a project as FILE_NAME_NOT_ALLOWED', async () => {
    await mkdir(path.join(folder, 'dir.json'))
    const result = await createStore(startDir).read('dir.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it.skipIf(!canMakePipe)('rejects a named pipe without opening it', async () => {
    await promisify(execFile)('mkfifo', [path.join(folder, 'pipe.json')])
    const result = await createStore(startDir).read('pipe.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it('rejects a hard link to a file outside the folder, and does not read it', async () => {
    await link(path.join(outside, 'secret.json'), path.join(folder, 'hard.json'))
    const result = await createStore(startDir).read('hard.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expectNameOnlyInUntrusted(result.problems[0], 'hard.json')
    expect(result).not.toHaveProperty('text')
  })

  it.skipIf(!canChmod)('reports an unreadable file as FILE_NOT_FOUND', async () => {
    const file = path.join(folder, 'locked.json')
    await writeFile(file, 'locked')
    await chmod(file, 0o000)
    const result = await createStore(startDir).read('locked.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NOT_FOUND'])
    expectNameOnlyInUntrusted(result.problems[0], 'locked.json')
  })

  it('reads a file of exactly 5 MB', async () => {
    const text = 'a'.repeat(MAX_BYTES)
    await writeFile(path.join(folder, 'big.json'), text)
    const result = await createStore(startDir).read('big.json')
    expect(result.ok).toBe(true)
    expect(result.text).toHaveLength(MAX_BYTES)
  })

  it('rejects a file above 5 MB as FILE_TOO_LARGE without reading it', async () => {
    await writeFile(path.join(folder, 'huge.json'), 'a'.repeat(MAX_BYTES + 1))
    const open = vi.spyOn(fsp, 'open')
    const result = await createStore(startDir).read('huge.json')
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_TOO_LARGE'])
    expectNameOnlyInUntrusted(result.problems[0], 'huge.json')
    expect(open).not.toHaveBeenCalled()
  })

  it('does not follow a symlink put in place after the check', async () => {
    await symlink(path.join(outside, 'secret.json'), path.join(folder, 'swapped.json'))
    const realLstat = fsp.lstat
    // The check sees a regular file, as it would just before the swap.
    vi.spyOn(fsp, 'lstat').mockImplementation(async (file) =>
      file.endsWith('swapped.json')
        ? realLstat(path.join(startDir, 'secret.json'))
        : realLstat(file),
    )
    const result = await createStore(startDir).read('swapped.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(result).not.toHaveProperty('text')
  })

  it('rejects a file that grew above 5 MB after the check', async () => {
    await writeFile(path.join(folder, 'grew.json'), 'a'.repeat(MAX_BYTES + 1))
    await writeFile(path.join(folder, 'small.json'), 'a')
    const realLstat = fsp.lstat
    vi.spyOn(fsp, 'lstat').mockImplementation(async (file) =>
      realLstat(file.endsWith('grew.json') ? path.join(folder, 'small.json') : file),
    )
    const result = await createStore(startDir).read('grew.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_TOO_LARGE'])
    expect(result).not.toHaveProperty('text')
  })

  it('rejects a file that gained a second hard link after the check', async () => {
    await writeFile(path.join(outside, 'linked-later.json'), 'secret')
    await link(path.join(outside, 'linked-later.json'), path.join(folder, 'linked.json'))
    await writeFile(path.join(folder, 'small.json'), 'a')
    const realLstat = fsp.lstat
    vi.spyOn(fsp, 'lstat').mockImplementation(async (file) =>
      realLstat(file.endsWith('linked.json') ? path.join(folder, 'small.json') : file),
    )
    const result = await createStore(startDir).read('linked.json')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(result).not.toHaveProperty('text')
  })

  it('closes the file after reading it', async () => {
    await writeFile(path.join(folder, 'team.json'), 'text')
    const realOpen = fsp.open
    const close = []
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await realOpen(...args)
      const realClose = handle.close.bind(handle)
      handle.close = async () => {
        close.push('closed')
        return realClose()
      }
      return handle
    })
    await createStore(startDir).read('team.json')
    expect(close).toEqual(['closed'])
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
    expectNameOnlyInUntrusted(result.problems[0], 'team.json')
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

  it('rejects a directory in the way as FILE_NAME_NOT_ALLOWED', async () => {
    await mkdir(path.join(folder, 'dir.json'))
    const before = await snapshot(tmp)
    const result = await createStore(startDir).write('dir.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(await snapshot(tmp)).toEqual(before)
  })

  it.skipIf(!canMakePipe)('rejects a named pipe in the way without opening it', async () => {
    await promisify(execFile)('mkfifo', [path.join(folder, 'pipe.json')])
    const result = await createStore(startDir).write('pipe.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it('rejects a hard link to a file outside the folder, and leaves that file unchanged', async () => {
    await link(path.join(outside, 'secret.json'), path.join(folder, 'hard.json'))
    const store = createStore(startDir)
    const result = await store.write('hard.json', 'overwritten')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect((await store.write('hard.json', 'x', { mustBeNew: true })).problems[0].code).toBe(
      'FILE_NAME_NOT_ALLOWED',
    )
    expect(await readFile(path.join(outside, 'secret.json'), 'utf8')).toBe('outside secret')
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

  it.skipIf(!canChmod)('reports an unwritable folder as FILE_SAVE_FAILED', async () => {
    await chmod(folder, 0o500)
    try {
      const result = await createStore(startDir).write('first.json', 'x')
      expect(result.ok).toBe(false)
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expectNameOnlyInUntrusted(result.problems[0], 'first.json')
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

  it('reports a failed write as FILE_SAVE_FAILED with the name only in untrusted', async () => {
    const result = await createStore(path.join(startDir, 'secret.json')).write('team.json', 'x')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    expectNameOnlyInUntrusted(result.problems[0], 'team.json')
  })

  describe('when the write fails part way', () => {
    // Writes the first bytes to the temp file, then fails, as a full disk would.
    const failAfterPartialWrite = () => {
      const realOpen = fsp.open
      vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
        const handle = await realOpen(...args)
        const realWriteFile = handle.writeFile.bind(handle)
        handle.writeFile = async (text) => {
          await realWriteFile(text.slice(0, 2))
          throw new Error('disk full')
        }
        return handle
      })
    }

    it('leaves the old file intact and no temp file behind', async () => {
      const file = path.join(folder, 'team.json')
      await writeFile(file, 'old text')
      const before = await snapshot(tmp)
      failAfterPartialWrite()
      const result = await createStore(startDir).write('team.json', 'new text')
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expect(await snapshot(tmp)).toEqual(before)
    })

    it('does not block a retry of a new project, and leaves no temp file', async () => {
      failAfterPartialWrite()
      const store = createStore(startDir)
      const failed = await store.write('first.json', 'new text', { mustBeNew: true })
      expect(failed.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expect(await readdir(folder)).toEqual([])
      vi.restoreAllMocks()
      expect(await store.write('first.json', 'new text', { mustBeNew: true })).toEqual({ ok: true })
      expect(await readdir(folder)).toEqual(['first.json'])
    })

    it('leaves the old file intact when the rename fails', async () => {
      const file = path.join(folder, 'team.json')
      await writeFile(file, 'old text')
      const before = await snapshot(tmp)
      vi.spyOn(fsp, 'rename').mockRejectedValue(new Error('cross-device'))
      const result = await createStore(startDir).write('team.json', 'new text')
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expect(await snapshot(tmp)).toEqual(before)
    })

    it('reports a link failure other than a taken name as FILE_SAVE_FAILED and cleans up', async () => {
      const before = await snapshot(tmp)
      vi.spyOn(fsp, 'link').mockRejectedValue(
        Object.assign(new Error('no links'), { code: 'EPERM' }),
      )
      const result = await createStore(startDir).write('first.json', 'x', { mustBeNew: true })
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
      expect(await snapshot(tmp)).toEqual(before)
    })

    it('treats a taken name that is not a new project as a failed save', async () => {
      vi.spyOn(fsp, 'rename').mockRejectedValue(Object.assign(new Error('x'), { code: 'EEXIST' }))
      const result = await createStore(startDir).write('first.json', 'x')
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    })
  })

  it('leaves no temp file behind after a successful write or new project', async () => {
    const store = createStore(startDir)
    await store.write('team.json', 'first')
    await store.write('team.json', 'second')
    await store.write('fresh.json', 'new', { mustBeNew: true })
    expect((await readdir(folder)).sort()).toEqual(['fresh.json', 'team.json'])
  })

  it('writes a new project as a file with no other hard link', async () => {
    await createStore(startDir).write('fresh.json', 'new', { mustBeNew: true })
    expect((await lstat(path.join(folder, 'fresh.json'))).nlink).toBe(1)
  })

  it('removes the temp name as soon as a new project is linked, leaving one link', async () => {
    const realLink = fsp.link
    const events = []
    vi.spyOn(fsp, 'link').mockImplementation(async (...args) => {
      await realLink(...args)
      events.push(`link nlink=${(await lstat(args[1])).nlink}`)
    })
    const realUnlink = fsp.unlink
    vi.spyOn(fsp, 'unlink').mockImplementation(async (file) => {
      events.push(`unlink ${path.basename(file).startsWith('.') ? 'temp' : 'target'}`)
      return realUnlink(file)
    })
    await createStore(startDir).write('fresh.json', 'new', { mustBeNew: true })
    expect(events).toEqual(['link nlink=2', 'unlink temp'])
    expect((await lstat(path.join(folder, 'fresh.json'))).nlink).toBe(1)
  })

  it('removes the new project it linked when the temp name cannot be removed', async () => {
    const realUnlink = fsp.unlink
    const unlink = vi.spyOn(fsp, 'unlink').mockImplementation(async (file) => {
      if (path.basename(file).startsWith('.')) throw new Error('io error')
      return realUnlink(file)
    })
    const result = await createStore(startDir).write('fresh.json', 'new', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    expect(unlink.mock.calls.map(([file]) => path.basename(file))).toContain('fresh.json')
    vi.restoreAllMocks()
    expect((await readdir(folder)).filter((file) => file === 'fresh.json')).toEqual([])
  })

  it('still reports the failed save when the linked project cannot be removed either', async () => {
    vi.spyOn(fsp, 'unlink').mockRejectedValue(new Error('io error'))
    const result = await createStore(startDir).write('fresh.json', 'new', { mustBeNew: true })
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
  })

  it('writes to a temp file that is created exclusively, under a name no project can have', async () => {
    const open = vi.spyOn(fsp, 'open')
    await createStore(startDir).write('team.json', 'x')
    expect(open).toHaveBeenCalledTimes(1)
    const [file, flags] = open.mock.calls[0]
    expect(path.basename(file)).toMatch(/^\./)
    expect(flags).toBe('wx')
  })

  it('flushes the temp file to disk before it replaces or creates a project', async () => {
    const events = []
    const realOpen = fsp.open
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await realOpen(...args)
      const realSync = handle.sync.bind(handle)
      handle.sync = async () => {
        events.push('sync')
        return realSync()
      }
      return handle
    })
    const realRename = fsp.rename
    vi.spyOn(fsp, 'rename').mockImplementation(async (...args) => {
      events.push('rename')
      return realRename(...args)
    })
    const realLink = fsp.link
    vi.spyOn(fsp, 'link').mockImplementation(async (...args) => {
      events.push('link')
      return realLink(...args)
    })
    const store = createStore(startDir)
    await store.write('team.json', 'x')
    await store.write('fresh.json', 'y', { mustBeNew: true })
    expect(events).toEqual(['sync', 'rename', 'sync', 'link'])
  })

  it('closes the temp file when the flush fails, and leaves the old file intact', async () => {
    const file = path.join(folder, 'team.json')
    await writeFile(file, 'old text')
    const before = await snapshot(tmp)
    const realOpen = fsp.open
    let closed = false
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await realOpen(...args)
      const realClose = handle.close.bind(handle)
      handle.sync = async () => {
        throw new Error('io error')
      }
      handle.close = async () => {
        closed = true
        return realClose()
      }
      return handle
    })
    const result = await createStore(startDir).write('team.json', 'new text')
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_SAVE_FAILED'])
    expect(closed).toBe(true)
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('writes text of exactly 5 MB', async () => {
    const text = 'a'.repeat(MAX_BYTES)
    expect(await createStore(startDir).write('big.json', text)).toEqual({ ok: true })
    expect(await readFile(path.join(folder, 'big.json'), 'utf8')).toHaveLength(MAX_BYTES)
  })

  it('rejects text above 5 MB as FILE_TOO_LARGE, counting bytes, and changes nothing', async () => {
    const file = path.join(folder, 'team.json')
    await writeFile(file, 'old text')
    const before = await snapshot(tmp)
    const store = createStore(startDir)
    // 2 bytes per character: under the cap by length, over it by bytes.
    const wide = '\u00e9'.repeat(MAX_BYTES / 2 + 1)
    for (const text of ['a'.repeat(MAX_BYTES + 1), wide]) {
      const result = await store.write('team.json', text)
      expect(result.ok).toBe(false)
      expect(result.problems.map((p) => p.code)).toEqual(['FILE_TOO_LARGE'])
      expectNameOnlyInUntrusted(result.problems[0], 'team.json')
    }
    expect(await snapshot(tmp)).toEqual(before)
  })

  it('does not create the projects folder for text that is too large', async () => {
    await rm(folder, { recursive: true })
    const result = await createStore(startDir).write('big.json', 'a'.repeat(MAX_BYTES + 1))
    expect(result.problems.map((p) => p.code)).toEqual(['FILE_TOO_LARGE'])
    expect(await readdir(startDir)).not.toContain('projects')
  })

  it('has no temp file to remove when the name is rejected', async () => {
    const unlink = vi.spyOn(fsp, 'unlink')
    await createStore(startDir).write('../x.json', 'x')
    expect(unlink).not.toHaveBeenCalled()
  })
})
