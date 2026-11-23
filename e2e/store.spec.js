import { test, expect } from './fixtures.js'
import { scan } from './axe.js'
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
  fixturePath,
  fixtureRecord,
  importAndConfirm,
  readDownloadedJson,
  replaceQuestion,
  starterRecordAs,
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

const STORE_NOTICE = 'Not saved in this browser. Export to keep your work.'
const storeNotice = (page) => page.getByText(STORE_NOTICE)

// Init scripts that leave the app no IndexedDB, each in its own way.
const REFUSED_STORAGE = [
  [
    'missing',
    () => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    },
  ],
  [
    'throwing on open',
    () => {
      IDBFactory.prototype.open = () => {
        throw new Error('refused')
      }
    },
  ],
  [
    'failing to open with an error event',
    () => {
      IDBFactory.prototype.open = () => {
        const request = {}
        setTimeout(() => request.onerror?.(new Event('error')))
        return request
      }
    },
  ],
  [
    'blocked by another tab',
    () => {
      IDBFactory.prototype.open = () => {
        const request = {}
        setTimeout(() => request.onblocked?.(new Event('blocked')))
        return request
      }
    },
  ],
]
const [, refuseIndexedDb] = REFUSED_STORAGE[1]

const storeUnavailableCount = async (page, capture) => {
  await flushConsole(page)
  return recordsIn(capture.messages).filter(({ record }) => record.code === 'STORE_UNAVAILABLE')
    .length
}

test.describe('working when the browser is not saving', () => {
  for (const [state, refuse] of REFUSED_STORAGE) {
    test(`storage that is ${state} falls back to this tab, with a lasting notice`, async ({
      page,
      capture,
      diagnostics,
    }) => {
      diagnostics.expect(['STORE_UNAVAILABLE'])
      await page.addInitScript(refuse)
      await page.goto('/#/')
      await expect(storeNotice(page)).toBeVisible()
      await expect(page.getByRole('region', { name: 'Projects' })).toContainText('No projects yet')
      expect(await storeUnavailableCount(page, capture)).toBe(1)
    })
  }

  test('projects still work until the tab closes', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_UNAVAILABLE'])
    await page.addInitScript(refuseIndexedDb)
    await page.goto('/#/')
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('dialog').getByLabel('Project name').fill('Checkout')
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('banner')).toContainText('Checkout')
    await expect(storeNotice(page)).toBeVisible()
    await importAndConfirm(
      page,
      fixturePath(STARTER_FIXTURE),
      replaceQuestion('Untitled Project', 'Checkout'),
    )
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await deleteStep(page, 'Idea')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)

    await page.getByRole('banner').getByRole('link', { name: 'AI Enabler' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(storeNotice(page)).toBeVisible()
    const card = page.locator('.projects__list > li')
    await page.getByRole('button', { name: 'More actions for Untitled Project' }).click()
    await card.getByRole('button', { name: 'Rename', exact: true }).click()
    await page.getByRole('dialog').getByLabel('Project name').fill('Payments')
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'More actions for Payments' }).click()
    await card.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await expect(card.getByRole('link')).toHaveText(['Payments (copy)', 'Payments'])
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'More actions for Payments', exact: true }).click()
    await card.getByRole('button', { name: 'Export', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('payments.ai-enabler.json')
    const exported = await readDownloadedJson(download)
    expect(stepIds(exported)).not.toContain('idea')
    expect(exported.nodes).toHaveLength(STARTER_STEP_COUNT - 1)
  })

  test('the notice shows on the not-found page too', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_UNAVAILABLE', 'STORE_PROJECT_NOT_FOUND'])
    await page.addInitScript(refuseIndexedDb)
    await page.goto('/#/projects/nowhere')
    await expect(page.getByRole('heading', { level: 1, name: 'Project not found' })).toBeVisible()
    await expect(storeNotice(page)).toBeVisible()
  })

  test('leaving the tab while not saved asks first', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_UNAVAILABLE'])
    await page.addInitScript(refuseIndexedDb)
    await page.goto('/#/')
    await expect(storeNotice(page)).toBeVisible()
    // A browser asks before unload only on a page the user has interacted with.
    await page.getByRole('heading', { level: 1 }).click()
    const asked = page.waitForEvent('dialog')
    await page.close({ runBeforeUnload: true })
    const dialog = await asked
    expect(dialog.type()).toBe('beforeunload')
    await dialog.accept()
  })

  test('with storage refused, the homepage and the project view have no axe violations', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_UNAVAILABLE'])
    await page.addInitScript(refuseIndexedDb)
    await page.goto('/#/')
    await expect(storeNotice(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('dialog').getByLabel('Project name').fill('Checkout')
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('banner')).toContainText('Checkout')
    await expect(storeNotice(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})

test.describe('leaving a project with a change that is not saved', () => {
  const leaveDialog = (page) => page.getByRole('dialog', { name: 'Leave without saving?' })
  const homeLink = (page) => page.getByRole('banner').getByRole('link', { name: 'AI Enabler' })

  // Opens the saved "Checkout" from the homepage, then deletes Idea with the write refused.
  const openWithUnsavedChange = async (page) => {
    await page.addInitScript(abortFileWrites, FILES_STORE)
    await page.goto('/#/')
    await page.evaluate(() => {
      window.allowFileWrites = true
    })
    await seedProjects(page, [await starterRecordAs('p1', { name: 'Checkout' })])
    await page.evaluate(() => {
      window.allowFileWrites = false
    })
    await page.reload()
    await page.getByRole('link', { name: 'Open Checkout' }).click()
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await deleteStep(page, 'Idea')
    await expect(storageProblems(page)).toBeVisible()
  }
  const expectStillOnMap = async (page) => {
    await expect(leaveDialog(page)).toHaveCount(0)
    await expect(page).toHaveURL(/#\/projects\/p1$/)
    await expect(page.getByRole('banner')).toContainText('Checkout')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
    await expect(cardByTitle(page, 'Idea')).toHaveCount(0)
  }

  test('the header home link, then Stay, keeps the map', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await expect(storeNotice(page)).toBeVisible()
    await homeLink(page).click()
    await expect(leaveDialog(page)).toContainText(
      'Your last change to Checkout is not saved in this browser. Export first to keep it.',
    )
    await leaveDialog(page).getByRole('button', { name: 'Stay' }).click()
    await expectStillOnMap(page)
  })

  test('the header home link, then Leave, shows the homepage', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await homeLink(page).click()
    await leaveDialog(page).getByRole('button', { name: 'Leave' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'AI Enabler' })).toBeFocused()
  })

  test("the browser's Back, then Stay, keeps the map", async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await page.goBack()
    await expect(leaveDialog(page)).toBeVisible()
    await leaveDialog(page).getByRole('button', { name: 'Stay' }).click()
    await expectStillOnMap(page)
  })

  test("the browser's Back, then Leave, shows the homepage", async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await page.goBack()
    await leaveDialog(page).getByRole('button', { name: 'Leave' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(leaveDialog(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'AI Enabler' })).toBeFocused()
  })

  test('after Stay, leaving again asks again', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await page.goBack()
    await leaveDialog(page).getByRole('button', { name: 'Stay' }).click()
    await expectStillOnMap(page)
    await homeLink(page).click()
    await expect(leaveDialog(page)).toBeVisible()
  })

  test('a rename from the homepage that works clears the failed save', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await homeLink(page).click()
    await leaveDialog(page).getByRole('button', { name: 'Leave' }).click()
    await page.evaluate(() => {
      window.allowFileWrites = true
    })
    await page.getByRole('button', { name: 'More actions for Checkout' }).click()
    await page.getByRole('button', { name: 'Rename', exact: true }).click()
    const renameDialog = page.getByRole('dialog', { name: 'Rename project' })
    await renameDialog.getByLabel('Project name').fill('Payments')
    await renameDialog.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('link', { name: 'Open Payments' }).click()
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await expect(storeNotice(page)).toHaveCount(0)
    await expect(storageProblems(page)).toHaveCount(0)
    await homeLink(page).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(leaveDialog(page)).toHaveCount(0)
  })

  test('leaving a fully saved project does not ask', async ({ page }) => {
    await page.goto('/#/')
    await seedProjects(page, [await starterRecordAs('p1', { name: 'Checkout' })])
    await page.goto('/#/projects/p1')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await deleteStep(page, 'Idea')
    await waitForStored(page, 'p1', (file) => !stepIds(file).includes('idea'))
    await homeLink(page).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(leaveDialog(page)).toHaveCount(0)
    await expect(storeNotice(page)).toHaveCount(0)
  })

  test('a failed save shows the lasting notice until a save works', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await openWithUnsavedChange(page)
    await expect(storeNotice(page)).toBeVisible()
    await page.evaluate(() => {
      window.allowFileWrites = true
    })
    await deleteStep(page, 'Plan')
    await expect(storeNotice(page)).toHaveCount(0)
  })
})
