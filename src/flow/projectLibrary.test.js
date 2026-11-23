import { describe, expect, it } from 'vitest'
import { createMemoryStoreAdapter } from './memoryStoreAdapter.js'
import {
  OPEN_OUTCOME,
  createProjectLibrary,
  observeLibrary,
  toOpenOutcome,
} from './projectLibrary.js'
import { createProjectStore } from './projectStore.js'
import oldFile from './schema/fixtures/0.0.0.json?raw'

const DAY_ONE = '2026-11-01T10:00:00.000Z'

const memoryProject = (id, name) => ({
  project: { id, name },
  nodes: [{ id: 's1', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Plan' } }],
  edges: [],
})

// A library over a memory adapter that already holds `records`: [id, name, text].
const libraryWith = async (records = []) => {
  const adapter = createMemoryStoreAdapter()
  for (const [id, name, text] of records) {
    await adapter.put({ id, name, modifiedAt: DAY_ONE }, text)
  }
  const store = createProjectStore(adapter)
  return { adapter, store, library: createProjectLibrary(store) }
}

const codes = (result) => result.problems.map(({ code }) => code)

describe('project library open', () => {
  it('opens a saved project as the in-memory project it was saved from', async () => {
    const { library } = await libraryWith()
    await library.save(memoryProject('p1', 'Checkout'))
    expect(await library.open('p1')).toEqual({
      ok: true,
      problems: [],
      project: memoryProject('p1', 'Checkout'),
    })
  })

  it('upgrades a file saved at an older schema and writes nothing', async () => {
    const { library, store } = await libraryWith([['old', 'Fixture 0.0.0', oldFile]])
    const opened = await library.open('old')
    expect(opened.ok).toBe(true)
    expect(opened.project.project.name).toBe('Fixture 0.0.0')
    expect(opened.project.nodes.length).toBeGreaterThan(0)
    expect((await store.read('old')).text).toBe(oldFile)
    expect((await store.list()).projects[0].modifiedAt).toBe(DAY_ONE)
  })

  it('reports an id that is not stored', async () => {
    const { library } = await libraryWith()
    expect(codes(await library.open('nope'))).toEqual(['STORE_PROJECT_NOT_FOUND'])
  })

  it('reports a file that cannot be opened with STORE_FILE_INVALID first, then its own problems', async () => {
    const broken = JSON.stringify({
      schemaVersion: '0.1.0',
      exportedAt: DAY_ONE,
      project: { id: 'b', name: 'Broken' },
      nodes: [{ id: 's1', type: 'step', data: { label: 'Plan' } }],
      edges: [],
    })
    const { library } = await libraryWith([['b', 'Broken', broken]])
    const opened = await library.open('b')
    expect(opened.ok).toBe(false)
    expect(opened.name).toBe('Broken')
    expect(codes(opened)[0]).toBe('STORE_FILE_INVALID')
    expect(codes(opened)).toContain('STEP_POSITION_MISSING')
    expect(opened.problems[0].message).not.toContain('Broken')
    expect(opened.problems[0].untrusted).toEqual({ id: 'b', name: 'Broken' })
  })

  it('reports text that is not JSON as a file that cannot be opened', async () => {
    const { library } = await libraryWith([['x', 'Garbled', 'not json']])
    expect(codes(await library.open('x'))).toEqual(['STORE_FILE_INVALID', 'FILE_NOT_JSON'])
  })
})

describe('project library create', () => {
  const libraryCreating = (adapter = createMemoryStoreAdapter()) => {
    const store = createProjectStore(adapter)
    return { store, library: createProjectLibrary(store, { newId: () => 'new-id' }) }
  }

  it('creates and saves an empty project with a new id', async () => {
    const { library, store } = libraryCreating()
    const created = await library.create('Checkout')
    const empty = { project: { id: 'new-id', name: 'Checkout' }, nodes: [], edges: [] }
    expect(created).toEqual({ ok: true, problems: [], project: empty })
    expect((await store.list()).projects.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'new-id', name: 'Checkout' },
    ])
    expect((await library.open('new-id')).project).toEqual(empty)
  })

  it('rejects a blank name and saves nothing', async () => {
    const { library, store } = libraryCreating()
    expect(codes(await library.create('  '))).toEqual(['FILE_PROJECT_NAME_EMPTY'])
    expect((await store.list()).projects).toEqual([])
  })

  it('reports a failed write and lists nothing', async () => {
    const adapter = createMemoryStoreAdapter()
    const { library, store } = libraryCreating({
      ...adapter,
      put: async () => {
        throw new Error('refused')
      },
    })
    const created = await library.create('Checkout')
    expect(created.ok).toBe(false)
    expect(codes(created)).toEqual(['STORE_WRITE_FAILED'])
    expect((await store.list()).projects).toEqual([])
  })
})

describe('toOpenOutcome', () => {
  it('is found with the project for an open that worked', async () => {
    const { library } = await libraryWith()
    await library.save(memoryProject('p1', 'Checkout'))
    expect(toOpenOutcome(await library.open('p1'))).toEqual({
      type: OPEN_OUTCOME.found,
      project: memoryProject('p1', 'Checkout'),
    })
  })

  it('is missing for an id that is not stored', async () => {
    const { library } = await libraryWith()
    const outcome = toOpenOutcome(await library.open('nope'))
    expect(outcome.type).toBe(OPEN_OUTCOME.missing)
    expect(codes(outcome)).toEqual(['STORE_PROJECT_NOT_FOUND'])
  })

  it('is unopenable with the stored name for a file that cannot be opened', async () => {
    const { library } = await libraryWith([['x', 'Garbled', 'not json']])
    const outcome = toOpenOutcome(await library.open('x'))
    expect(outcome).toMatchObject({ type: OPEN_OUTCOME.unopenable, name: 'Garbled' })
    expect(codes(outcome)).toEqual(['STORE_FILE_INVALID', 'FILE_NOT_JSON'])
  })

  it('is unopenable with no name when the store cannot be read', async () => {
    const adapter = createMemoryStoreAdapter()
    const failing = {
      ...adapter,
      getFile: async () => {
        throw new Error('gone')
      },
    }
    const library = createProjectLibrary(createProjectStore(failing))
    const outcome = toOpenOutcome(await library.open('p1'))
    expect(outcome).toMatchObject({ type: OPEN_OUTCOME.unopenable, name: null })
    expect(codes(outcome)).toEqual(['STORE_UNAVAILABLE'])
  })
})

describe('observeLibrary', () => {
  const observedLibrary = (failingPut) => {
    const adapter = createMemoryStoreAdapter()
    const base = failingPut ? { ...adapter, put: failingPut } : adapter
    const library = createProjectLibrary(createProjectStore(base))
    const seen = { problems: [], firstSaves: 0 }
    const observed = observeLibrary(library, {
      onProblems: (problems) => seen.problems.push(...problems.map(({ code }) => code)),
      onFirstSave: () => {
        seen.firstSaves += 1
      },
    })
    return { observed, seen }
  }

  it('hands over the problems of each failed call once', async () => {
    const { observed, seen } = observedLibrary()
    await observed.open('nope')
    expect(seen.problems).toEqual(['STORE_PROJECT_NOT_FOUND'])
  })

  it('calls onFirstSave after the first save that works, and never again', async () => {
    const { observed, seen } = observedLibrary()
    await observed.save(memoryProject('p1', 'Checkout'))
    await observed.save(memoryProject('p1', 'Checkout'))
    await observed.save(memoryProject('p2', 'Payments'))
    expect(seen).toEqual({ problems: [], firstSaves: 1 })
  })

  it('counts a create that works as the first save', async () => {
    const { observed, seen } = observedLibrary()
    await observed.create('Checkout')
    await observed.save(memoryProject('p1', 'Checkout'))
    expect(seen).toEqual({ problems: [], firstSaves: 1 })
  })

  it('does not count a failed save as the first save', async () => {
    const calls = { count: 0 }
    const { observed, seen } = observedLibrary(async () => {
      calls.count += 1
      if (calls.count === 1) throw new Error('refused')
    })
    await observed.save(memoryProject('p1', 'Checkout'))
    expect(seen).toEqual({ problems: ['STORE_WRITE_FAILED'], firstSaves: 0 })
    await observed.save(memoryProject('p1', 'Checkout'))
    expect(seen.firstSaves).toBe(1)
  })
})
