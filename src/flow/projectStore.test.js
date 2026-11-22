import { describe, expect, it } from 'vitest'
import { parseImport } from './importFile.js'
import { createMemoryStoreAdapter } from './memoryStoreAdapter.js'
import { SORT, createProjectStore } from './projectStore.js'

const DAY = '2026-11-2'
const at = (iso) => () => new Date(iso)

const memoryProject = (id, name, stepCount = 0) => ({
  project: { id, name },
  nodes: Array.from({ length: stepCount }, (_, index) => ({
    id: `s${index}`,
    position: { x: index * 200, y: 0 },
    data: { label: `Step ${index}` },
  })),
  edges: [],
})

// A clock that hands out the given times in order.
const clock = (...isoTimes) => {
  const times = [...isoTimes]
  return () => new Date(times.shift())
}

// Wraps an adapter so the named call fails (or is slow) on the listed call numbers, counted from 1.
const withFaults = (adapter, { call, fails = [], slow = [] }) => {
  const counter = { count: 0 }
  return {
    ...adapter,
    [call]: async (...args) => {
      counter.count += 1
      const n = counter.count
      if (slow.includes(n)) await new Promise((resolve) => setTimeout(resolve, 20))
      if (fails.includes(n)) throw new Error(`${call} refused`)
      return adapter[call](...args)
    },
  }
}

const stepsOf = (text) => JSON.parse(text).nodes.length

const names = (result) => result.projects.map(({ name }) => name)

const ids = (result) => result.projects.map(({ id }) => id)

const seeded = async (projects, options = {}) => {
  const adapter = createMemoryStoreAdapter()
  for (const [id, name, modifiedAt] of projects) {
    await adapter.put({ id, name, modifiedAt }, '{}')
  }
  return createProjectStore(adapter, options)
}

describe('project store', () => {
  it('lists a saved project and reads it back as an unedited export', async () => {
    const store = createProjectStore(createMemoryStoreAdapter(), {
      now: at('2026-11-22T10:00:00.000Z'),
    })
    const saved = await store.save(memoryProject('p1', 'Checkout', 2))
    expect(saved).toEqual({ ok: true, problems: [], modifiedAt: '2026-11-22T10:00:00.000Z' })
    expect((await store.list()).projects).toEqual([
      { id: 'p1', name: 'Checkout', modifiedAt: '2026-11-22T10:00:00.000Z' },
    ])
    const { text } = await store.read('p1')
    const imported = await parseImport(text)
    expect(imported).toMatchObject({ ok: true, edited: false })
    expect(imported.file.project).toEqual({ id: 'p1', name: 'Checkout' })
  })

  it('lists by last modified, newest first', async () => {
    const store = await seeded([
      ['a', 'A', `${DAY}1T10:00:00.000Z`],
      ['b', 'B', `${DAY}3T10:00:00.000Z`],
      ['c', 'C', `${DAY}2T10:00:00.000Z`],
    ])
    expect(names(await store.list())).toEqual(['B', 'C', 'A'])
  })

  it('lists by name, ignoring case and accents', async () => {
    const store = await seeded([
      ['1', 'beta', `${DAY}1T10:00:00.000Z`],
      ['2', 'Alpha', `${DAY}2T10:00:00.000Z`],
      ['3', 'Éclair', `${DAY}3T10:00:00.000Z`],
      ['4', 'gamma', `${DAY}4T10:00:00.000Z`],
    ])
    expect(names(await store.list({ sort: SORT.name }))).toEqual([
      'Alpha',
      'beta',
      'Éclair',
      'gamma',
    ])
  })

  it.each([SORT.modified, SORT.name])(
    'keeps a stable id order for ties when sorted by %s',
    async (sort) => {
      const store = await seeded([
        ['a2', 'Same', '2026-11-22T10:00:00.000Z'],
        ['a1', 'Same', '2026-11-22T10:00:00.000Z'],
      ])
      expect(ids(await store.list({ sort }))).toEqual(['a1', 'a2'])
    },
  )

  it('lists nothing for an empty store', async () => {
    const store = createProjectStore(createMemoryStoreAdapter())
    expect(await store.list()).toEqual({ ok: true, problems: [], projects: [] })
  })

  it('stores the newest of two saves when the first write is slow', async () => {
    const adapter = withFaults(createMemoryStoreAdapter(), { call: 'put', slow: [1] })
    const store = createProjectStore(adapter)
    const first = store.save(memoryProject('p1', 'Checkout', 3))
    const second = store.save(memoryProject('p1', 'Checkout', 2))
    await Promise.all([first, second])
    expect(stepsOf((await store.read('p1')).text)).toBe(2)
  })

  it('lists the newest name while a save is still being written', async () => {
    const adapter = withFaults(createMemoryStoreAdapter(), { call: 'put', slow: [1, 2] })
    const store = createProjectStore(adapter)
    await store.save(memoryProject('p1', 'Checkout'))
    store.save(memoryProject('p1', 'Payments'))
    expect(names(await store.list())).toEqual(['Payments'])
  })

  it('stores the latest state with the next save after a failed one', async () => {
    const adapter = withFaults(createMemoryStoreAdapter(), { call: 'put', fails: [1] })
    const store = createProjectStore(adapter, {
      now: clock('2026-11-22T10:00:00.000Z', '2026-11-22T10:05:00.000Z'),
    })
    const first = await store.save(memoryProject('p1', 'Checkout', 3))
    const second = await store.save(memoryProject('p1', 'Checkout', 2))
    expect(first.problems.map(({ code }) => code)).toEqual(['STORE_WRITE_FAILED'])
    expect(second.ok).toBe(true)
    expect(stepsOf((await store.read('p1')).text)).toBe(2)
    expect((await store.list()).projects[0].modifiedAt).toBe('2026-11-22T10:05:00.000Z')
  })

  it.each([
    ['put', 'saved', (store) => store.save(memoryProject('p1', 'Checkout')), 'STORE_WRITE_FAILED'],
    ['remove', 'removed', (store) => store.remove('p1'), 'STORE_WRITE_FAILED'],
    ['getFile', 'read', (store) => store.read('p1'), 'STORE_UNAVAILABLE'],
    ['listIndex', 'listed', (store) => store.list(), 'STORE_UNAVAILABLE'],
  ])(
    'reports a refused %s when a project is %s, without its name',
    async (call, _verb, run, code) => {
      const base = createMemoryStoreAdapter()
      await base.put({ id: 'p1', name: 'Checkout', modifiedAt: '2026-11-22T10:00:00.000Z' }, '{}')
      const store = createProjectStore(withFaults(base, { call, fails: [1] }))
      const result = await run(store)
      expect(result.ok).toBe(false)
      expect(result.problems).toHaveLength(1)
      const [found] = result.problems
      expect(found.code).toBe(code)
      expect(found.message).not.toContain('Checkout')
      expect(found.message).not.toContain('p1')
      expect(JSON.stringify({ ...found, untrusted: undefined })).not.toContain('Checkout')
    },
  )

  it('keeps the project name in untrusted for a refused save', async () => {
    const store = createProjectStore(
      withFaults(createMemoryStoreAdapter(), { call: 'put', fails: [1] }),
    )
    const { problems } = await store.save(memoryProject('p1', 'Checkout'))
    expect(problems[0].untrusted).toEqual({ id: 'p1', name: 'Checkout' })
  })

  it('reports an id that is not stored when it is read or removed', async () => {
    const store = createProjectStore(createMemoryStoreAdapter())
    const codes = async (result) => (await result).problems.map(({ code }) => code)
    expect(await codes(store.read('nope'))).toEqual(['STORE_PROJECT_NOT_FOUND'])
    expect(await codes(store.remove('nope'))).toEqual(['STORE_PROJECT_NOT_FOUND'])
  })

  it('drops a removed project from the list and from reads', async () => {
    const store = await seeded([
      ['a', 'A', `${DAY}1T10:00:00.000Z`],
      ['b', 'B', `${DAY}2T10:00:00.000Z`],
    ])
    expect(await store.remove('a')).toEqual({ ok: true, problems: [] })
    expect(names(await store.list())).toEqual(['B'])
    expect((await store.read('a')).problems[0].code).toBe('STORE_PROJECT_NOT_FOUND')
  })

  it('falls back to last modified for an unknown sort', async () => {
    const store = await seeded([
      ['a', 'A', `${DAY}1T10:00:00.000Z`],
      ['b', 'B', `${DAY}2T10:00:00.000Z`],
    ])
    expect(names(await store.list({ sort: 'size' }))).toEqual(['B', 'A'])
  })
})
