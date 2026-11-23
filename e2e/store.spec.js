import { test, expect } from './fixtures.js'
import { cardByTitle, cards, connect, dragStep, edgeBetween } from './canvas.js'
import { flushConsole, recordsIn } from './console.js'
import {
  FILES_STORE,
  abortFileWrites,
  databaseNames,
  readIndex,
  readStored,
  seedProjects,
  waitForStored,
} from './store.js'
import {
  STARTER_FIXTURE,
  STARTER_ID,
  STARTER_STEP_COUNT,
  exportProjectFile,
  fixtureRecord,
  openStarterView,
  sendEdit,
} from './views.js'

const announcer = (page) => page.locator('[aria-live="polite"]')
const storageProblems = (page) => page.getByRole('region', { name: 'Storage problems' })
const stepIds = (file) => file.nodes.map(({ id }) => id)
const hasEdge = (file, source, target) =>
  file.edges.some((edge) => edge.source === source && edge.target === target)
const positionOf = (file, id) => file.nodes.find((node) => node.id === id).position
const STARTER_PLAN_X = 200

const deleteStep = async (page, title) => {
  await cardByTitle(page, title).click()
  await page.keyboard.press('Backspace')
}

const EDITS = [
  {
    edit: 'delete the step Idea',
    run: (page) => deleteStep(page, 'Idea'),
    isStored: (file) => !stepIds(file).includes('idea'),
    expectShown: (page) => expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1),
  },
  {
    edit: 'connect Idea to Test',
    run: (page) => connect(page, 'Idea', 'Test'),
    isStored: (file) => hasEdge(file, 'idea', 'test'),
    expectShown: (page) => expect(edgeBetween(page, 'idea', 'test')).toHaveCount(1),
  },
  {
    edit: 'move the step Plan right',
    run: (page) => dragStep(page, 'Plan', { x: 120, y: 0 }),
    isStored: (file) => positionOf(file, 'plan').x > STARTER_PLAN_X,
    expectShown: async (page) => {
      const file = JSON.parse(await readStored(page, STARTER_ID))
      expect(positionOf(file, 'plan').x).toBeGreaterThan(STARTER_PLAN_X)
      await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    },
  },
]

for (const { edit, run, isStored, expectShown } of EDITS) {
  test(`an accepted edit stays after a reload: ${edit}`, async ({ page }) => {
    await openStarterView(page)
    await run(page)
    await waitForStored(page, STARTER_ID, isStored)
    await page.reload()
    await expect(cards(page).first()).toBeVisible()
    await expectShown(page)
  })
}

test('a rejected edit writes nothing', async ({ page, diagnostics }) => {
  diagnostics.expect(['CONN_SELF'])
  await openStarterView(page)
  await deleteStep(page, 'Idea')
  await waitForStored(page, STARTER_ID, (file) => !stepIds(file).includes('idea'))
  const stored = await readStored(page, STARTER_ID)
  await sendEdit(page, [{ name: 'connect', args: { sourceId: 'plan', targetId: 'plan' } }])
  await expect(page.getByRole('region', { name: 'Edit problems' })).toBeVisible()
  expect(await readStored(page, STARTER_ID)).toBe(stored)
})

test('a failed save keeps the change and says so until a save works', async ({
  page,
  capture,
  diagnostics,
}) => {
  diagnostics.expect(['STORE_WRITE_FAILED'])
  await page.addInitScript(abortFileWrites, FILES_STORE)
  await page.goto('/#/')
  await page.evaluate(() => {
    window.allowFileWrites = true
  })
  await seedProjects(page, [fixtureRecord(STARTER_FIXTURE)])
  await page.evaluate(() => {
    window.allowFileWrites = false
  })
  await page.goto(`/#/projects/${STARTER_ID}`)
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)

  await deleteStep(page, 'Idea')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
  await expect(announcer(page)).toHaveText(
    'Not saved. This change could not be saved in this browser.',
  )
  await expect(storageProblems(page)).toContainText('Not saved: 1 problem')
  await expect(storageProblems(page)).toContainText(
    'This change could not be saved in this browser.',
  )
  expect(stepIds(await exportProjectFile(page))).not.toContain('idea')
  await flushConsole(page)
  const failures = recordsIn(capture.messages).filter(
    ({ record }) => record.code === 'STORE_WRITE_FAILED',
  )
  expect(failures).toHaveLength(1)

  await page.evaluate(() => {
    window.allowFileWrites = true
  })
  await deleteStep(page, 'Plan')
  await expect(storageProblems(page)).toHaveCount(0)
  await waitForStored(page, STARTER_ID, (file) => !stepIds(file).includes('plan'))
  await page.reload()
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 2)
})

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
