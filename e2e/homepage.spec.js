import path from 'node:path'
import { test, expect } from './fixtures.js'
import { problem } from '../src/flow/diagnostics/problem.js'
import { withContentHash } from '../src/flow/projectFile.js'
import { scan } from './axe.js'
import { flushConsole, recordsIn } from './console.js'
import { FILES_STORE, abortFileWrites, readIndex, readStored, seedProjects } from './store.js'
import {
  EXPORT_BUTTON_NAME,
  asUpload,
  exportProjectFile,
  openStarterProject,
  readDownloadedJson,
  starterRecordAs,
  withoutHash,
} from './views.js'

test.use({ timezoneId: 'UTC' })

const projectsRegion = (page) => page.getByRole('region', { name: 'Projects' })
// The cards, not the items of an open card menu.
const cardItems = (page) => projectsRegion(page).locator('.projects__list > li')
const EMPTY_TEXT = 'No projects yet. Create one or import a project file.'
const announcer = (page) => page.locator('[aria-live="polite"]')
const storageProblems = (page) => page.getByRole('region', { name: 'Storage problems' })
const menuButton = (page, name) => page.getByRole('button', { name: `More actions for ${name}` })
const cardLink = (page, name) => page.getByRole('link', { name: `Open ${name}`, exact: true })
const cardFor = (page, name) => cardItems(page).filter({ has: cardLink(page, name) })
const cardNames = (page) => cardItems(page).getByRole('link')
// Opens the card's menu and chooses `action`.
const chooseAction = async (page, name, action) => {
  await menuButton(page, name).click()
  await cardFor(page, name).getByRole('button', { name: action, exact: true }).click()
}
const allowWrites = (page, allowed) =>
  page.evaluate((value) => {
    window.allowFileWrites = value
  }, allowed)
// The text of a download.
const downloadedText = async (download) => {
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}
// A stored project whose file has a step with no position, so it cannot be opened.
const BROKEN_FILE = {
  schemaVersion: '0.1.0',
  exportedAt: '2026-11-22T10:00:00.000Z',
  project: { id: 'broken', name: 'Broken' },
  nodes: [{ id: 's1', type: 'step', data: { label: 'Plan' } }],
  edges: [],
}
const BROKEN_TEXT = `${JSON.stringify(BROKEN_FILE, null, 2)}\n`
const BROKEN_RECORD = {
  id: 'broken',
  name: 'Broken',
  modifiedAt: '2026-11-22T10:00:00.000Z',
  text: BROKEN_TEXT,
}
const seedBroken = async (page) => {
  await page.goto('/#/')
  await seedProjects(page, [BROKEN_RECORD])
  await page.reload()
}

// Seeds the starter saved as each `[id, name, modifiedAt]`, then opens the homepage.
const openHomeWith = async (page, projects) => {
  await page.goto('/#/projects/none')
  const records = await Promise.all(
    projects.map(([id, name, modifiedAt]) => starterRecordAs(id, { name, modifiedAt })),
  )
  await seedProjects(page, records)
  await page.goto('/#/')
}

test('the homepage lists saved projects newest first, with their modified dates', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
  await openHomeWith(page, [
    ['a', 'A', '2026-11-21T09:00:00.000Z'],
    ['b', 'B', '2026-11-22T10:00:00.000Z'],
  ])
  await expect(page).toHaveTitle('AI Enabler')
  await expect(page.getByRole('heading', { level: 1, name: 'AI Enabler' })).toBeFocused()
  await expect(cardItems(page).getByRole('link')).toHaveText(['B', 'A'])
  await expect(cardItems(page).locator('time')).toHaveText([
    '22 Nov 2026, 10:00',
    '21 Nov 2026, 09:00',
  ])
  await expect(cardItems(page).first()).toContainText('Modified 22 Nov 2026, 10:00')
  await expect(cardItems(page).first().locator('time')).toHaveAttribute(
    'datetime',
    '2026-11-22T10:00:00.000Z',
  )
})

test('sorting by name lists A to Z, ignoring case', async ({ page, diagnostics }) => {
  diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
  await openHomeWith(page, [
    ['1', 'beta', '2026-11-22T10:00:00.000Z'],
    ['2', 'Alpha', '2026-11-21T10:00:00.000Z'],
  ])
  await expect(cardItems(page).getByRole('link')).toHaveText(['beta', 'Alpha'])
  await page.getByLabel('Sort by').selectOption({ label: 'Name' })
  await expect(cardItems(page).getByRole('link')).toHaveText(['Alpha', 'beta'])
})

test('a card opens its project at its own link', async ({ page, diagnostics }) => {
  diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
  await openHomeWith(page, [['p1', 'Checkout', '2026-11-22T10:00:00.000Z']])
  await page.getByRole('link', { name: 'Open Checkout' }).click()
  await expect(page).toHaveURL(/#\/projects\/p1$/)
  await expect(page.getByRole('banner')).toContainText('Checkout')
})

test('the list shows "Loading projects…" and never the empty state before the cards', async ({
  page,
}) => {
  await page.goto('/#/')
  await seedProjects(page, [await starterRecordAs('a')])
  // Every text the list's status line shows from the next load on.
  await page.addInitScript(() => {
    window.statusTexts = []
    new MutationObserver(() => {
      const status = document.querySelector('.projects__status')
      if (status) window.statusTexts.push(status.textContent)
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.goto('/#/')
  await page.reload()
  await expect(cardItems(page)).toHaveCount(1)
  const texts = await page.evaluate(() => window.statusTexts)
  expect(texts).toContain('Loading projects…')
  expect(texts).not.toContain(EMPTY_TEXT)
})

test('with nothing saved, the homepage says so', async ({ page }) => {
  await page.goto('/#/')
  await expect(projectsRegion(page)).toContainText(EMPTY_TEXT)
  await expect(cardItems(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible()
})

test.describe('creating a project', () => {
  const newProject = (page) => page.getByRole('button', { name: 'New project' })
  const dialog = (page) => page.getByRole('dialog', { name: 'New project' })
  const nameField = (page) => dialog(page).getByLabel('Project name')
  const createNamed = async (page, name) => {
    await newProject(page).click()
    await nameField(page).fill(name)
    await dialog(page).getByRole('button', { name: 'Create' }).click()
  }

  test('opens the empty map at its own link, and lists it on the homepage', async ({ page }) => {
    await page.goto('/#/')
    await createNamed(page, 'Checkout')
    await expect(page).toHaveURL(/#\/projects\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('banner')).toContainText('Checkout')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page.getByRole('main').getByRole('status')).toHaveText(
      'This map has no steps yet. Import a project file to fill it.',
    )
    await page.goto('/#/')
    await expect(cardItems(page).getByRole('link')).toHaveText(['Checkout'])
  })

  test('keeps the dialog open for a blank name, marks the field and saves nothing', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['FILE_PROJECT_NAME_EMPTY'])
    await page.goto('/#/')
    await createNamed(page, '  ')
    await expect(dialog(page)).toBeVisible()
    await expect(nameField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(nameField(page)).toHaveAccessibleDescription(/\S/)
    await expect(nameField(page)).toBeFocused()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    expect(await readIndex(page)).toEqual([])
  })

  test('stays on the homepage when the browser refuses the write', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await page.addInitScript(abortFileWrites, FILES_STORE)
    await page.goto('/#/')
    await createNamed(page, 'Checkout')
    await expect(dialog(page)).toContainText('This change could not be saved in this browser.')
    await expect(page).toHaveURL(/#\/$/)
    await expect(cardItems(page)).toHaveCount(0)
  })

  test('a second click on Create while the first is saving makes one project', async ({ page }) => {
    await page.goto('/#/')
    await newProject(page).click()
    await nameField(page).fill('Checkout')
    await dialog(page).getByRole('button', { name: 'Create' }).click({ clickCount: 2 })
    await expect(page).toHaveURL(/#\/projects\/[0-9a-f-]{36}$/)
    await page.goto('/#/')
    await expect(cardItems(page).getByRole('link')).toHaveText(['Checkout'])
    expect(await readIndex(page)).toHaveLength(1)
  })

  test('cancel saves nothing and returns focus to New project', async ({ page }) => {
    await page.goto('/#/')
    await newProject(page).click()
    await nameField(page).fill('Checkout')
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(newProject(page)).toBeFocused()
    expect(await readIndex(page)).toEqual([])
  })
})

test('the header brand leads home, with focus on its heading', async ({ page }) => {
  await openStarterProject(page)
  await page.getByRole('banner').getByRole('link', { name: 'AI Enabler' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'AI Enabler' })).toBeFocused()
})

test.describe('homepage accessibility', () => {
  const LONG_NAME = 'W'.repeat(200)
  const THREE = [
    ['a', 'Alpha', '2026-11-20T10:00:00.000Z'],
    ['b', 'Beta', '2026-11-21T10:00:00.000Z'],
    ['c', LONG_NAME, '2026-11-22T10:00:00.000Z'],
  ]

  test('with no projects there are no violations', async ({ page }) => {
    await page.goto('/#/')
    await expect(projectsRegion(page)).toContainText(EMPTY_TEXT)
    expect(await scan(page)).toEqual([])
  })

  test('with three projects there are no violations, and every control is reachable by Tab', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, THREE)
    await expect(cardItems(page)).toHaveCount(3)
    expect(await scan(page)).toEqual([])
    const reached = []
    for (let press = 0; press < 8; press += 1) {
      await page.keyboard.press('Tab')
      reached.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''))
    }
    expect(reached).toEqual(expect.arrayContaining(['New project', 'Alpha', 'Beta', LONG_NAME]))
  })

  test('a 200-character name wraps inside its card at 320px', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await page.setViewportSize({ width: 320, height: 640 })
    await openHomeWith(page, THREE)
    const card = cardItems(page).first()
    await expect(card).toContainText(LONG_NAME)
    const fits = await card.evaluate((element) => element.scrollWidth <= element.clientWidth)
    expect(fits).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })

  test('with the create dialog open there are no violations', async ({ page }) => {
    await page.goto('/#/')
    await page.getByRole('button', { name: 'New project' }).click()
    await expect(page.getByRole('dialog', { name: 'New project' })).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('with a card menu open, and with the delete confirm open, there are no violations', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, THREE)
    await menuButton(page, 'Alpha').click()
    await expect(cardFor(page, 'Alpha').getByRole('button', { name: 'Delete' })).toBeVisible()
    expect(await scan(page)).toEqual([])
    await cardFor(page, 'Alpha').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})

test.describe('card actions', () => {
  const CHECKOUT = [['p1', 'Checkout', '2026-11-22T10:00:00.000Z']]
  // A, B and C, listed in that order (newest first).
  const ABC = [
    ['a', 'A', '2026-11-22T10:00:00.000Z'],
    ['b', 'B', '2026-11-21T10:00:00.000Z'],
    ['c', 'C', '2026-11-20T10:00:00.000Z'],
  ]
  const renameDialog = (page) => page.getByRole('dialog', { name: 'Rename project' })
  const renameTo = async (page, from, to) => {
    await chooseAction(page, from, 'Rename')
    await renameDialog(page).getByLabel('Project name').fill(to)
    await renameDialog(page).getByRole('button', { name: 'Save' }).click()
  }
  const deleteDialog = (page, name) =>
    page.getByRole('dialog', { name: `Delete ${name}? This can't be undone.` })
  const deleteAndConfirm = async (page, name) => {
    await chooseAction(page, name, 'Delete')
    await deleteDialog(page, name).getByRole('button', { name: 'Delete' }).click()
  }

  test('the card menu works by keyboard', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    const button = menuButton(page, 'Checkout')
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeFocused()
    await page.keyboard.press('Enter')
    for (const label of ['Rename', 'Duplicate', 'Replace from file', 'Export', 'Delete']) {
      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: label, exact: true })).toBeFocused()
    }
    await page.keyboard.press('Tab')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('a press outside closes the card menu', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await menuButton(page, 'Checkout').click()
    await expect(menuButton(page, 'Checkout')).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('heading', { level: 1 }).click()
    await expect(menuButton(page, 'Checkout')).toHaveAttribute('aria-expanded', 'false')
  })

  test('renaming from a card', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await chooseAction(page, 'Checkout', 'Rename')
    await expect(renameDialog(page).getByLabel('Project name')).toHaveValue('Checkout')
    await renameDialog(page).getByLabel('Project name').fill('Payments')
    await renameDialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(cardNames(page)).toHaveText(['Payments'])
    await expect(menuButton(page, 'Payments')).toBeFocused()
    await cardLink(page, 'Payments').click()
    await expect(page.getByRole('banner')).toContainText('Payments')
  })

  test('cancelling a rename changes nothing', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await chooseAction(page, 'Checkout', 'Rename')
    await renameDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(renameDialog(page)).toHaveCount(0)
    await expect(cardNames(page)).toHaveText(['Checkout'])
    await expect(menuButton(page, 'Checkout')).toBeFocused()
  })

  test('renaming to a blank name is rejected', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND', 'FILE_PROJECT_NAME_EMPTY'])
    await openHomeWith(page, CHECKOUT)
    await renameTo(page, 'Checkout', '')
    await expect(renameDialog(page)).toContainText(problem('FILE_PROJECT_NAME_EMPTY').message)
    await expect(cardNames(page)).toHaveText(['Checkout'])
  })

  test('duplicating keeps the user on the homepage', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await chooseAction(page, 'Checkout', 'Duplicate')
    await expect(cardLink(page, 'Checkout (copy)')).toBeFocused()
    await expect(announcer(page)).toHaveText('Duplicated Checkout')
    await expect(page).toHaveURL(/#\/$/)
    const copyId = (await readIndex(page)).find(({ name }) => name === 'Checkout (copy)').id
    const source = JSON.parse(await readStored(page, 'p1'))
    const copy = JSON.parse(await readStored(page, copyId))
    const comparable = (file) => ({ ...withoutHash(file), project: null, exportedAt: null })
    expect(comparable(copy)).toEqual(comparable(source))
    expect(copy.project).toEqual({ id: copyId, name: 'Checkout (copy)' })
    expect(copy.nodes).toHaveLength(6)
    expect(copy.edges).toHaveLength(5)
    // Its own hash, so the copy reads as unedited, not "changed outside AI Enabler".
    expect((await withContentHash(withoutHash(copy))).contentHash).toBe(copy.contentHash)
  })

  test('duplicating a copy appends again', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, [['p1', 'Checkout (copy)', '2026-11-22T10:00:00.000Z']])
    await chooseAction(page, 'Checkout (copy)', 'Duplicate')
    await expect(cardLink(page, 'Checkout (copy) (copy)')).toBeVisible()
  })

  test('deleting asks first and moves focus to the next card', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, ABC)
    await deleteAndConfirm(page, 'B')
    await expect(cardNames(page)).toHaveText(['A', 'C'])
    await expect(announcer(page)).toHaveText('Deleted B')
    await expect(cardLink(page, 'C')).toBeFocused()
  })

  test('deleting the last card moves focus to the previous one', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, ABC.slice(0, 2))
    await deleteAndConfirm(page, 'B')
    await expect(cardLink(page, 'A')).toBeFocused()
  })

  test('deleting the only project moves focus to New project', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, ABC.slice(0, 1))
    await deleteAndConfirm(page, 'A')
    await expect(projectsRegion(page)).toContainText(EMPTY_TEXT)
    await expect(page.getByRole('button', { name: 'New project' })).toBeFocused()
  })

  test('cancelling delete changes nothing', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, ABC.slice(0, 1))
    await chooseAction(page, 'A', 'Delete')
    await deleteDialog(page, 'A').getByRole('button', { name: 'Cancel' }).click()
    await expect(deleteDialog(page, 'A')).toHaveCount(0)
    await expect(cardNames(page)).toHaveText(['A'])
    await expect(menuButton(page, 'A')).toBeFocused()
    expect((await readIndex(page)).map(({ id }) => id)).toEqual(['a'])
  })

  const REFUSED = [
    ['delete', (page) => deleteAndConfirm(page, 'A')],
    ['duplicate', (page) => chooseAction(page, 'A', 'Duplicate')],
  ]
  for (const [action, run] of REFUSED) {
    test(`a card action the browser refuses changes nothing: ${action}`, async ({
      page,
      capture,
      diagnostics,
    }) => {
      diagnostics.expect(['STORE_WRITE_FAILED'])
      await page.addInitScript(abortFileWrites, FILES_STORE)
      await page.goto('/#/')
      await allowWrites(page, true)
      await seedProjects(page, [
        await starterRecordAs('a', { name: 'A', modifiedAt: '2026-11-22T10:00:00.000Z' }),
        await starterRecordAs('b', { name: 'B', modifiedAt: '2026-11-21T10:00:00.000Z' }),
      ])
      await page.reload()
      await expect(cardNames(page)).toHaveText(['A', 'B'])
      await run(page)
      await expect(storageProblems(page)).toContainText(problem('STORE_WRITE_FAILED').message)
      await expect(cardNames(page)).toHaveText(['A', 'B'])
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(menuButton(page, 'A')).toBeFocused()
      await expect(announcer(page)).toHaveText('')
      await flushConsole(page)
      const failures = recordsIn(capture.messages).filter(
        ({ record }) => record.code === 'STORE_WRITE_FAILED',
      )
      expect(failures).toHaveLength(1)
    })
  }

  test('a rename the browser refuses keeps its dialog open with the problem', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await page.addInitScript(abortFileWrites, FILES_STORE)
    await page.goto('/#/')
    await allowWrites(page, true)
    await seedProjects(page, [
      await starterRecordAs('a', { name: 'A', modifiedAt: '2026-11-22T10:00:00.000Z' }),
    ])
    await page.reload()
    await renameTo(page, 'A', 'A2')
    await expect(renameDialog(page)).toContainText(problem('STORE_WRITE_FAILED').message)
    await expect(renameDialog(page).getByLabel('Project name')).toHaveValue('A2')
    await expect(cardNames(page)).toHaveText(['A'])
    await expect(announcer(page)).toHaveText('')
    expect((await readIndex(page)).map(({ name }) => name)).toEqual(['A'])
  })

  test('a project that cannot be opened offers only repair actions', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_FILE_INVALID', 'STEP_POSITION_MISSING'])
    await seedBroken(page)
    await page.goto('/#/projects/broken')
    await expect(page.getByRole('heading', { level: 1, name: "Can't open Broken" })).toBeVisible()
    await page.goto('/#/')
    await menuButton(page, 'Broken').click()
    await expect(cardFor(page, 'Broken').getByRole('listitem')).toHaveText([
      'Replace from file',
      'Export',
      'Delete',
    ])
  })

  test('a project that cannot be opened can still be deleted', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await seedBroken(page)
    await deleteAndConfirm(page, 'Broken')
    await expect(cardItems(page)).toHaveCount(0)
    await page.goto('/#/projects/broken')
    await expect(page.getByRole('heading', { level: 1, name: 'Project not found' })).toBeVisible()
  })

  test('exporting from a card matches exporting from the map', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    const downloadPromise = page.waitForEvent('download')
    await chooseAction(page, 'Checkout', 'Export')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('checkout.ai-enabler.json')
    await expect(announcer(page)).toHaveText('Exported checkout.ai-enabler.json')
    await expect(menuButton(page, 'Checkout')).toBeFocused()
    const fromCard = await readDownloadedJson(download)
    await cardLink(page, 'Checkout').click()
    await expect(page.getByRole('button', { name: EXPORT_BUTTON_NAME })).toBeVisible()
    const fromMap = await exportProjectFile(page)
    const comparable = (file) => ({ ...withoutHash(file), exportedAt: null })
    expect(comparable(fromCard)).toEqual(comparable(fromMap))
  })

  test('exporting a project that cannot be opened downloads it unchanged', async ({ page }) => {
    await seedBroken(page)
    const downloadPromise = page.waitForEvent('download')
    await chooseAction(page, 'Broken', 'Export')
    expect(await downloadedText(await downloadPromise)).toBe(BROKEN_TEXT)
  })
})

test.describe('replacing a card from a file', () => {
  const CHECKOUT = [['p1', 'Checkout', '2026-11-22T10:00:00.000Z']]
  const MARKED_FIXTURE = path.join(
    import.meta.dirname,
    '../src/flow/schema/fixtures/0.1.0-marked.json',
  )
  const confirm = (page) => page.getByRole('dialog')
  const importStatus = (page) => page.getByRole('region', { name: 'Import status' })
  // The starter file named `name`, as a file to choose.
  const fileNamed = async (name) => asUpload((await starterRecordAs('file-id', { name })).text)
  const replaceWith = async (page, name, file) => {
    const chooser = page.waitForEvent('filechooser')
    await chooseAction(page, name, 'Replace from file')
    await (await chooser).setFiles(file)
  }

  test('replacing a card from a file keeps its link', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await replaceWith(page, 'Checkout', await fileNamed('Payments'))
    await expect(confirm(page)).toHaveAccessibleName('Replace Checkout with Payments?')
    await confirm(page).getByRole('button', { name: 'Replace map' }).click()
    await expect(cardNames(page)).toHaveText(['Payments'])
    await expect(cardLink(page, 'Payments')).toHaveAttribute('href', '#/projects/p1')
    await expect(menuButton(page, 'Payments')).toBeFocused()
    await cardLink(page, 'Payments').click()
    await expect(page.getByRole('banner')).toContainText('Payments')
  })

  test('an edited file shows its notice before replacing', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    const file = JSON.parse((await starterRecordAs('file-id', { name: 'Payments' })).text)
    const [first, ...rest] = file.nodes
    const edited = {
      ...file,
      nodes: [{ ...first, data: { ...first.data, label: 'Edited' } }, ...rest],
    }
    await replaceWith(page, 'Checkout', asUpload(edited))
    await expect(confirm(page)).toContainText(
      'This file was changed outside AI Enabler after it was exported.',
    )
  })

  test('a file marked by an AI tool shows the AI notice before replacing', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    await replaceWith(page, 'Checkout', MARKED_FIXTURE)
    await expect(confirm(page)).toContainText(
      'This file was changed by AI tools (aie-mcp) on 2026-11-20. Review the steps and numbers before relying on them.',
    )
  })

  test('cancelling a replace changes nothing', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, CHECKOUT)
    const before = { index: await readIndex(page), text: await readStored(page, 'p1') }
    await replaceWith(page, 'Checkout', await fileNamed('Payments'))
    await confirm(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(confirm(page)).toHaveCount(0)
    await expect(cardNames(page)).toHaveText(['Checkout'])
    await expect(menuButton(page, 'Checkout')).toBeFocused()
    expect({ index: await readIndex(page), text: await readStored(page, 'p1') }).toEqual(before)
  })

  test('a rejected replace changes nothing and lists its problems', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND', 'STEP_POSITION_MISSING'])
    await openHomeWith(page, CHECKOUT)
    const before = await readStored(page, 'p1')
    await replaceWith(page, 'Checkout', asUpload(BROKEN_FILE))
    await expect(importStatus(page)).toContainText(
      problem('STEP_POSITION_MISSING', { params: { step: 'Step "Plan" (#1)' } }).message,
    )
    await expect(confirm(page)).toHaveCount(0)
    await expect(cardNames(page)).toHaveText(['Checkout'])
    expect(await readStored(page, 'p1')).toBe(before)
  })

  test('replacing an unopenable card repairs it', async ({ page }) => {
    await seedBroken(page)
    await replaceWith(page, 'Broken', await fileNamed('Fixed'))
    await expect(confirm(page)).toHaveAccessibleName('Replace Broken with Fixed?')
    await confirm(page).getByRole('button', { name: 'Replace map' }).click()
    await expect(cardNames(page)).toHaveText(['Fixed'])
    await cardLink(page, 'Fixed').click()
    await expect(page).toHaveURL(/#\/projects\/broken$/)
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })

  test('a replace the browser refuses changes nothing', async ({ page, capture, diagnostics }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await page.addInitScript(abortFileWrites, FILES_STORE)
    await page.goto('/#/')
    await allowWrites(page, true)
    await seedProjects(page, [await starterRecordAs('p1', { name: 'Checkout' })])
    await page.reload()
    await replaceWith(page, 'Checkout', await fileNamed('Payments'))
    await confirm(page).getByRole('button', { name: 'Replace map' }).click()
    await expect(storageProblems(page)).toContainText(problem('STORE_WRITE_FAILED').message)
    await expect(importStatus(page)).toHaveCount(0)
    await expect(announcer(page)).toHaveText(`Not saved. ${problem('STORE_WRITE_FAILED').message}`)
    await expect(cardNames(page)).toHaveText(['Checkout'])
    await expect(menuButton(page, 'Checkout')).toBeFocused()
    await flushConsole(page)
    const failures = recordsIn(capture.messages).filter(
      ({ record }) => record.code === 'STORE_WRITE_FAILED',
    )
    expect(failures).toHaveLength(1)
  })
})

test.describe('importing a project on the homepage', () => {
  const importStatus = (page) => page.getByRole('region', { name: 'Import status' })
  // The starter file with `id` and `name`, as a file to choose.
  const starterFile = async (id, name) => asUpload((await starterRecordAs(id, { name })).text)
  const importFile = async (page, file) => {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Import project' }).click()
    await (await chooser).setFiles(file)
  }

  test('adds a project with the file id, without a confirmation', async ({ page }) => {
    await page.goto('/#/')
    await importFile(page, await starterFile('abc', 'Payments'))
    await expect(cardLink(page, 'Payments')).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(cardLink(page, 'Payments')).toHaveAttribute('href', '#/projects/abc')
    await expect(importStatus(page)).toContainText('Imported Payments, 6 steps')
    await expect(announcer(page)).toHaveText('Imported Payments, 6 steps')
    await expect(page).toHaveURL(/#\/$/)
  })

  test('a taken id gets a new one', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await openHomeWith(page, [['abc', 'Checkout', '2026-11-20T10:00:00.000Z']])
    await importFile(page, await starterFile('abc', 'Payments'))
    await expect(cardNames(page)).toHaveText(['Payments', 'Checkout'])
    await expect(cardLink(page, 'Payments')).not.toHaveAttribute('href', '#/projects/abc')
    await expect(importStatus(page)).toContainText('Imported Payments as a new project, 6 steps')
  })

  test('two quick imports of one id both land', async ({ page }) => {
    await page.goto('/#/')
    const { text } = await starterRecordAs('abc', { name: 'Payments' })
    // Both files arrive in one task, so the second import starts before the first can finish.
    await page
      .locator('input[type="file"]')
      .first()
      .evaluate((input, fileText) => {
        const choose = () => {
          const files = new DataTransfer()
          files.items.add(new File([fileText], 'payments.json', { type: 'application/json' }))
          Object.defineProperty(input, 'files', { value: files.files, configurable: true })
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
        choose()
        choose()
      }, text)
    await expect(cardItems(page)).toHaveCount(2)
    const ids = (await readIndex(page)).map(({ id }) => id)
    expect(ids).toContain('abc')
    expect(new Set(ids).size).toBe(2)
  })

  test('a homepage import shows its notices', async ({ page }) => {
    await page.goto('/#/')
    const file = JSON.parse((await starterRecordAs('abc', { name: 'Payments' })).text)
    const [first, ...rest] = file.nodes
    const edited = {
      ...file,
      nodes: [{ ...first, data: { ...first.data, label: 'Edited' } }, ...rest],
    }
    await importFile(page, asUpload(edited))
    const notice = 'This file was changed outside AI Enabler after it was exported.'
    await expect(importStatus(page)).toContainText(notice)
    await expect(announcer(page)).toContainText(notice)
  })

  test('a rejected homepage import adds nothing', async ({ page, diagnostics }) => {
    diagnostics.expect(['FILE_NOT_JSON'])
    await page.goto('/#/')
    await importFile(page, asUpload('not json'))
    await expect(importStatus(page)).toContainText(problem('FILE_NOT_JSON').message)
    await expect(cardItems(page)).toHaveCount(0)
    await importStatus(page).getByRole('button', { name: 'Dismiss' }).click()
    await expect(importStatus(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Import project' })).toBeFocused()
  })

  test('a homepage import the browser refuses adds nothing', async ({
    page,
    capture,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_WRITE_FAILED'])
    await page.addInitScript(abortFileWrites, FILES_STORE)
    await page.goto('/#/')
    await importFile(page, await starterFile('abc', 'Payments'))
    await expect(storageProblems(page)).toContainText(problem('STORE_WRITE_FAILED').message)
    await expect(cardItems(page)).toHaveCount(0)
    await expect(announcer(page)).toHaveText(`Not saved. ${problem('STORE_WRITE_FAILED').message}`)
    await expect(importStatus(page)).toHaveCount(0)
    await flushConsole(page)
    const failures = recordsIn(capture.messages).filter(
      ({ record }) => record.code === 'STORE_WRITE_FAILED',
    )
    expect(failures).toHaveLength(1)
  })
})
