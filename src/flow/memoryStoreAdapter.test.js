import { describe, expect, it } from 'vitest'
import { createMemoryStoreAdapter } from './memoryStoreAdapter.js'
import { STORE_CONTRACT, runStoreContract } from './storeContract.js'

describe('memory store adapter', () => {
  it.each(Object.entries(STORE_CONTRACT))('meets the contract: %s', async (_name, check) => {
    expect(await check(createMemoryStoreAdapter())).toBeNull()
  })

  it('passes the whole contract', async () => {
    expect(await runStoreContract(createMemoryStoreAdapter)).toEqual([])
  })

  it('never shares an index entry with a caller', async () => {
    const adapter = createMemoryStoreAdapter()
    const entry = { id: 'a', name: 'Alpha', modifiedAt: '2026-11-22T10:00:00.000Z' }
    await adapter.put(entry, 'text')
    entry.name = 'Changed'
    const [listed] = await adapter.listIndex()
    listed.name = 'Changed again'
    expect(await adapter.listIndex()).toEqual([{ ...entry, name: 'Alpha' }])
  })
})

describe('store contract', () => {
  it('reports each check an adapter fails', async () => {
    const forgetful = () => ({ ...createMemoryStoreAdapter(), getFile: async () => undefined })
    const failures = await runStoreContract(forgetful)
    expect(failures.map(({ check }) => check)).toEqual(['put then get', 'put replaces'])
  })
})
