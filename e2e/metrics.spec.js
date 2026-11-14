import { test, expect } from '@playwright/test'
import { scan } from './axe.js'

const STARTER_STEP_COUNT = 6
const EMPTY_MAP_MESSAGE =
  'No steps on this map. Import a project, or reload to restore the starter map.'

const STARTER_TILES = [
  ['Total lead time', '12d 4h'],
  ['Total process time', '3d 2h'],
  ['Flow efficiency', '26.0% Watch'],
  ['First pass yield', '53.1% Watch'],
  ['Total queue', '34 Watch'],
  ['Avg process time', '4h 20m'],
  ['Steps', '6'],
]

const cards = (page) => page.locator('.react-flow__node')
const tiles = (page) => page.getByRole('region', { name: 'Metrics' }).locator('dl > div')
const tileValue = (page, label) =>
  tiles(page).filter({ has: page.getByText(label, { exact: true }) })

const deleteFirstCard = async (page) => {
  await cards(page).first().click()
  await page.keyboard.press('Backspace')
}

test('the starter metrics show seven tiles in spec order as term and description pairs', async ({
  page,
}) => {
  await page.goto('/')
  await expect(tiles(page)).toHaveCount(STARTER_TILES.length)
  await expect(tiles(page).locator('dt')).toHaveText(STARTER_TILES.map(([label]) => label))
  await expect(tiles(page).locator('dd')).toHaveText(STARTER_TILES.map(([, value]) => value))
})

test('deleting Idea updates the card count and every tile in the same update', async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  await cards(page).filter({ hasText: 'Idea' }).click()
  await page.keyboard.press('Backspace')

  await expect
    .poll(async () => ({
      cards: await cards(page).count(),
      steps: await tileValue(page, 'Steps').locator('dd').textContent(),
    }))
    .toEqual({ cards: STARTER_STEP_COUNT - 1, steps: '5' })
  await expect(tileValue(page, 'Total lead time').locator('dd')).toHaveText('9d 4h')
  await expect(tileValue(page, 'Total queue').locator('dd')).toHaveText('14 On target')
})

test.describe('with every step deleted', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    for (let remaining = STARTER_STEP_COUNT; remaining > 0; remaining -= 1) {
      await deleteFirstCard(page)
      await expect(cards(page)).toHaveCount(remaining - 1)
    }
  })

  test('every tile shows a dash and no status text', async ({ page }) => {
    await expect(tiles(page).locator('dd')).toHaveText(Array(STARTER_TILES.length).fill('—'))
  })

  test('the canvas explains the empty map in a status region', async ({ page }) => {
    await expect(page.getByRole('main').getByRole('status')).toHaveText(EMPTY_MAP_MESSAGE)
  })
})

const WIDTHS = [
  [1200, 'one row', (rowCount) => rowCount === 1],
  [1024, 'one row', (rowCount) => rowCount === 1],
  [1023, 'more than one row', (rowCount) => rowCount > 1],
  [800, 'more than one row', (rowCount) => rowCount > 1],
]

for (const [width, rows, isExpectedRowCount] of WIDTHS) {
  test(`at ${width}px the tiles occupy ${rows} without clipping a value`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/')
    await expect(tiles(page)).toHaveCount(STARTER_TILES.length)

    const tops = await tiles(page).evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    )
    const clippedValues = await tiles(page)
      .locator('dd')
      .evaluateAll((elements) =>
        elements.filter((element) => element.scrollWidth > element.clientWidth),
      )
    expect(clippedValues).toEqual([])
    expect(isExpectedRowCount(new Set(tops).size)).toBe(true)
  })
}

test('the default view with the metrics bar has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
})
