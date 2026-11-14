import { test, expect } from '@playwright/test'
import { scan } from './axe.js'
import { cardByTitle, cards } from './canvas.js'
import { deleteAllSteps, EMPTY_MAP_MESSAGE, STARTER_STEP_COUNT } from './views.js'

const STARTER_TILES = [
  ['Total lead time', '12d 4h'],
  ['Total process time', '3d 2h'],
  ['Flow efficiency', '26.0% Watch'],
  ['First pass yield', '53.1% Watch'],
  ['Total queue', '34 Watch'],
  ['Avg process time', '4h 20m'],
  ['Steps', '6'],
]

const tiles = (page) => page.getByRole('region', { name: 'Metrics' }).locator('dl > div')
const tileValue = (page, label) =>
  tiles(page).filter({ has: page.getByText(label, { exact: true }) })

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
  await cardByTitle(page, 'Idea').click()
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
    await deleteAllSteps(page)
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

    await page.evaluate(() => document.fonts.ready)

    await expect
      .poll(async () => {
        const tops = await tiles(page).evaluateAll((elements) =>
          elements.map((element) => Math.round(element.getBoundingClientRect().top)),
        )
        return isExpectedRowCount(new Set(tops).size)
      })
      .toBe(true)
    await expect
      .poll(() =>
        tiles(page)
          .locator('dd')
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.scrollWidth > element.clientWidth)
              .map((element) => element.textContent),
          ),
      )
      .toEqual([])
  })
}

const SINGLE_LINE_WIDTHS = [1200, 1024]

for (const width of SINGLE_LINE_WIDTHS) {
  test(`at ${width}px every value and status stays on a single line`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/')
    await expect(tiles(page)).toHaveCount(STARTER_TILES.length)
    await page.evaluate(() => document.fonts.ready)

    await expect
      .poll(() =>
        tiles(page)
          .locator('dd')
          .evaluateAll((elements) =>
            elements.flatMap((element) =>
              [...element.childNodes, ...element.querySelectorAll('.metric__status')]
                .filter((node) => node.textContent.trim() !== '')
                .filter((node) => {
                  const range = document.createRange()
                  range.selectNodeContents(node)
                  return range.getClientRects().length > 1
                })
                .map((node) => node.textContent),
            ),
          ),
      )
      .toEqual([])
  })
}

test('the default view with the metrics bar has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
})
