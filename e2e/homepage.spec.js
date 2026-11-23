import { test, expect } from './fixtures.js'
import { FILES_STORE, abortFileWrites, readIndex, seedProjects } from './store.js'
import { starterRecordAs } from './views.js'

test.use({ timezoneId: 'UTC' })

const projectsRegion = (page) => page.getByRole('region', { name: 'Projects' })
const cardItems = (page) => projectsRegion(page).getByRole('listitem')
const EMPTY_TEXT = 'No projects yet. Create one or import a project file.'

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
  await expect(cardItems(page)).toHaveText([
    'BModified 22 Nov 2026, 10:00',
    'AModified 21 Nov 2026, 09:00',
  ])
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
