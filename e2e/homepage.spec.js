import { test, expect } from './fixtures.js'
import { seedProjects } from './store.js'
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
})
