import { test, expect } from './fixtures.js'
import { FILES_STORE, abortFileWrites, databaseNames, readIndex, readStored } from './store.js'

const CONTRACT_MODULE = '/src/flow/storeContract.js'
const ADAPTER_MODULE = '/src/shell/indexedDbAdapter.js'

test('the browser store meets the adapter contract and is the only database', async ({ page }) => {
  await page.goto('/#/')
  const failures = await page.evaluate(
    async ({ contractPath, adapterPath }) => {
      const { runStoreContract } = await import(contractPath)
      const { createIndexedDbAdapter, openProjectsDatabase } = await import(adapterPath)
      const db = await openProjectsDatabase(indexedDB)
      // Each check gets an empty store: everything the last check wrote is removed first.
      const emptyAdapter = async () => {
        const adapter = createIndexedDbAdapter(db)
        for (const { id } of await adapter.listIndex()) await adapter.remove(id)
        return adapter
      }
      try {
        return await runStoreContract(emptyAdapter)
      } finally {
        db.close()
      }
    },
    { contractPath: CONTRACT_MODULE, adapterPath: ADAPTER_MODULE },
  )
  expect(failures).toEqual([])
  expect(await databaseNames(page)).toEqual(['ai-enabler'])
})

test('a write the browser aborts halfway stores nothing', async ({ page }) => {
  await page.addInitScript(abortFileWrites, FILES_STORE)
  await page.goto('/#/')
  const outcome = await page.evaluate(async (adapterPath) => {
    const { createIndexedDbAdapter, openProjectsDatabase } = await import(adapterPath)
    const db = await openProjectsDatabase(indexedDB)
    const adapter = createIndexedDbAdapter(db)
    try {
      await adapter.put(
        { id: 'p1', name: 'Checkout', modifiedAt: '2026-11-22T10:00:00.000Z' },
        '{}',
      )
      return 'resolved'
    } catch {
      return 'rejected'
    } finally {
      db.close()
    }
  }, ADAPTER_MODULE)
  expect(outcome).toBe('rejected')
  await page.evaluate(() => {
    window.allowFileWrites = true
  })
  expect(await readIndex(page)).toEqual([])
  expect(await readStored(page, 'p1')).toBeNull()
})
