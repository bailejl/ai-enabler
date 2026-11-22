import { test, expect } from './fixtures.js'
import { scan } from './axe.js'
import { cards } from './canvas.js'
import { openAllHelpSections, STARTER_STEP_COUNT } from './views.js'

const PROJECT_NAME = 'Untitled Project'
const LONG_PROJECT_NAME_LENGTH = 100
const HOW_TO_USE_LINES = 5

const expectStarterViewAccessible = async (page) => {
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
}

test('the header shows the mark, the brand, a divider, and the project name', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header.locator('svg.header__mark')).toBeVisible()
  await expect(header.getByText('AI Enabler', { exact: true })).toBeVisible()
  await expect(header.getByRole('separator')).toBeVisible()
  const projectName = header.getByText(PROJECT_NAME, { exact: true })
  await expect(projectName).toBeVisible()
  await expect(projectName).toHaveAttribute('title', PROJECT_NAME)
})

test('the document title names the project and the app', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Untitled Project · AI Enabler')
})

test('the page has banner, Help navigation, and Value stream map landmarks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Help' })).toBeAttached()
  await expect(page.getByRole('main', { name: 'Value stream map' })).toBeVisible()
})

test('a long project name truncates without hiding the brand', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 })
  await page.goto('/')
  const projectName = page.locator('.header__project')
  await projectName.evaluate((element, length) => {
    element.textContent = 'W'.repeat(length)
  }, LONG_PROJECT_NAME_LENGTH)
  const isTruncated = await projectName.evaluate((e) => e.scrollWidth > e.clientWidth)
  expect(isTruncated).toBe(true)
  await expect(page.getByText('AI Enabler', { exact: true })).toBeVisible()
})

test('reloading after deleting Idea restores six steps and stores nothing', async ({ page }) => {
  await page.goto('/')
  const steps = cards(page)
  await expect(steps).toHaveCount(STARTER_STEP_COUNT)
  await steps.filter({ hasText: 'Idea' }).click()
  await page.keyboard.press('Backspace')
  await expect(steps).toHaveCount(STARTER_STEP_COUNT - 1)

  await page.reload()

  await expect(steps).toHaveCount(STARTER_STEP_COUNT)
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0, databases: 0 })
})

test('the default view has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expectStarterViewAccessible(page)
})

const HELP_SECTIONS = ['How to use', 'Glossary', 'Help']

const REQUIRED_TERMS = [
  ['Step', 'A stage of the value stream, shown as a card on the canvas'],
  ['PT (process time)', 'Actual work time spent on an item at a step'],
  [
    'LT (lead time)',
    'Elapsed time an item spends at a step, from arrival to departure, including waiting',
  ],
  [
    '%C&A (percent complete and accurate)',
    "Share of a step's output that needs no rework downstream",
  ],
  ['Queue', 'Number of items waiting at a step'],
  ['Batch size', 'Number of items a step processes together'],
  ['Flow efficiency', 'Total PT ÷ total LT'],
  [
    'First pass yield',
    "Product of all steps' %C&A: the share of items that pass the whole stream without rework",
  ],
  ['Total queue', 'Sum of the queues of all steps'],
  ['Avg process time', 'Total PT ÷ number of steps'],
  ['Working day (d)', '8 hours, used for all duration display'],
  ['Project', 'A named value stream map with an internal id'],
  ['On target', 'The metric meets its goal. No action is needed'],
  ['Watch', 'The metric is below its goal but not yet a problem'],
  ['Needs attention', 'The metric is far from its goal and needs action'],
]

const helpNav = (page) => page.getByRole('navigation', { name: 'Help' })

const helpSection = (page, title) =>
  helpNav(page)
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: title }) })

test('the three help sections start collapsed', async ({ page }) => {
  await page.goto('/')
  const nav = helpNav(page)
  await expect(nav.locator('details')).toHaveCount(HELP_SECTIONS.length)
  await expect(nav.locator('details summary')).toHaveText(HELP_SECTIONS)
  await expect(nav.locator('details[open]')).toHaveCount(0)
})

test.describe('with every help section expanded', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await openAllHelpSections(page)
  })

  test('the glossary has exactly the required entries', async ({ page }) => {
    await expect(helpNav(page).locator('dl > div')).toHaveCount(REQUIRED_TERMS.length)
  })

  for (const [term, definition] of REQUIRED_TERMS) {
    test(`the glossary defines ${term}`, async ({ page }) => {
      const entry = helpNav(page)
        .locator('dl > div')
        .filter({ has: page.getByText(term, { exact: true }) })
      await expect(entry.locator('dd')).toBeVisible()
      await expect(entry.locator('dd')).toHaveText(definition)
    })
  }

  for (const title of ['How to use', 'Help']) {
    test(`${title} has text`, async ({ page }) => {
      const firstLine = helpSection(page, title).locator('p').first()
      await expect(firstLine).toBeVisible()
      await expect(firstLine).toHaveText(/\S/)
    })
  }

  test('How to use lists five lines', async ({ page }) => {
    const lines = helpSection(page, 'How to use').locator('p')
    await expect(lines).toHaveCount(HOW_TO_USE_LINES)
    await expect(lines.first()).toBeVisible()
    await expect(lines.last()).toBeVisible()
  })

  test('the help menu has no buttons or links', async ({ page }) => {
    await expect(helpNav(page).locator('button, a')).toHaveCount(0)
  })

  test('the view has no accessibility violations', async ({ page }) => {
    await expectStarterViewAccessible(page)
  })
})
