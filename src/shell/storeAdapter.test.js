import { describe, expect, it, vi } from 'vitest'
import { openStoreAdapter, requestDurableStorage } from './storeAdapter.js'

// An IDBFactory whose open request fires `event` (error or blocked) on the next tick.
const refusingFactory = (event) => ({
  open: () => {
    const request = { error: new Error('refused') }
    setTimeout(() => request[`on${event}`]?.())
    return request
  },
})

const throwingFactory = {
  open: () => {
    throw new Error('SecurityError')
  },
}

describe('openStoreAdapter', () => {
  it.each([
    ['there is no indexedDB', undefined],
    ['open throws', throwingFactory],
    ['open fires error', refusingFactory('error')],
    ['open fires blocked', refusingFactory('blocked')],
  ])('falls back to memory with STORE_UNAVAILABLE when %s', async (_label, factory) => {
    const opened = await openStoreAdapter({ factory: factory ?? null })
    expect(opened.persistent).toBe(false)
    expect(opened.problems.map(({ code }) => code)).toEqual(['STORE_UNAVAILABLE'])
    await opened.adapter.put({ id: 'p1', name: 'A', modifiedAt: '2026-11-22T10:00:00.000Z' }, 'x')
    expect(await opened.adapter.getFile('p1')).toBe('x')
  })
})

describe('requestDurableStorage', () => {
  it('asks the browser to persist storage', async () => {
    const persist = vi.fn(async () => true)
    await requestDurableStorage({ storage: { persist } })
    expect(persist).toHaveBeenCalledOnce()
  })

  it.each([
    ['refuses', { persist: async () => Promise.reject(new Error('no')) }],
    ['has no persist', {}],
    ['has no storage manager', null],
  ])('resolves when the browser %s', async (_label, storage) => {
    await expect(requestDurableStorage({ storage })).resolves.toBeUndefined()
  })
})
