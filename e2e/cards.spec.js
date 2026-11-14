import { test, expect } from '@playwright/test'
import { scan } from './axe.js'
import { cardByTitle, cards, settledBox } from './canvas.js'
import { STARTER_STEP_COUNT } from './views.js'

// The badge's visible letters, not its visually hidden name.
const badgeIn = (card, text) => card.getByText(text, { exact: true })

const centerOf = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
})

test('the Build card shows its title and PT, LT and %C&A values', async ({ page }) => {
  const card = cardByTitle(page, 'Build')
  await expect(card.getByRole('heading', { name: 'Build' })).toBeVisible()
  await expect(card.locator('dd')).toHaveText(['1d', '2d 4h', '90%'])
  await expect(card.locator('dt > [aria-hidden="true"]')).toHaveText(['PT', 'LT', '%C&A'])
})

const STARTER_TITLES = ['Idea', 'Plan', 'Build', 'Test', 'Deploy', 'Production']

for (const title of STARTER_TITLES) {
  test(`the ${title} card's accessible name is its step title`, async ({ page }) => {
    await expect(page.getByRole('group', { name: title, exact: true })).toHaveCount(1)
  })
}

test.describe('after a step is deleted from the keyboard', () => {
  const focusedStepTitle = (page) =>
    page.evaluate(() => document.activeElement?.closest('.react-flow__node')?.textContent ?? null)

  test('focus moves to the next step instead of the page body', async ({ page }) => {
    await cardByTitle(page, 'Build').click()
    await page.keyboard.press('Backspace')
    await expect(cardByTitle(page, 'Build')).toHaveCount(0)

    await expect.poll(() => focusedStepTitle(page)).toContain('Test')
  })

  test('focus lands on the canvas, inside it, once no step is left', async ({ page }) => {
    for (let remaining = STARTER_STEP_COUNT; remaining > 0; remaining -= 1) {
      await cards(page).first().click()
      await page.keyboard.press('Backspace')
      await expect(cards(page)).toHaveCount(remaining - 1)
    }

    await expect(page.getByRole('main')).toBeFocused()
  })
})

test('the Build card rows are spoken as their full names', async ({ page }) => {
  await expect(cardByTitle(page, 'Build').locator('dl')).toMatchAriaSnapshot(`
    - term: process time
    - definition: 1d
    - term: lead time
    - definition: 2d 4h
    - term: percent complete and accurate
    - definition: 90%
  `)
})

test("Idea's queue badge Q 20 is named and sits in the card's upper-left quarter", async ({
  page,
}) => {
  const card = cardByTitle(page, 'Idea')
  const badge = badgeIn(card, 'Q 20')
  await expect(badge.locator('xpath=..').getByText('20 items waiting')).toHaveCount(1)

  const cardBox = await settledBox(card)
  const badgeCenter = centerOf(await badge.boundingBox())
  expect(badgeCenter.x).toBeLessThan(cardBox.x + cardBox.width / 2)
  expect(badgeCenter.y).toBeLessThan(cardBox.y + cardBox.height / 2)
  expect(badgeCenter.x).toBeLessThan(cardBox.x + cardBox.width / 4)
  expect(badgeCenter.y).toBeLessThan(cardBox.y + cardBox.height / 4)
})

test("only Production has a batch badge B 3, named and in the card's upper-right quarter", async ({
  page,
}) => {
  await expect(page.getByText('Batch size 3')).toHaveCount(1)
  const card = cardByTitle(page, 'Production')
  const badge = badgeIn(card, 'B 3')
  await expect(badge.locator('xpath=..').getByText('Batch size 3')).toHaveCount(1)

  const cardBox = await settledBox(card)
  const badgeCenter = centerOf(await badge.boundingBox())
  expect(badgeCenter.x).toBeGreaterThan(cardBox.x + (cardBox.width * 3) / 4)
  expect(badgeCenter.y).toBeLessThan(cardBox.y + cardBox.height / 4)
})

test('each card has one left target handle and one right source handle', async ({ page }) => {
  const allCards = cards(page)
  await expect(allCards.locator('.react-flow__handle')).toHaveCount(STARTER_STEP_COUNT * 2)
  await expect(allCards.locator('.react-flow__handle-left.target')).toHaveCount(STARTER_STEP_COUNT)
  await expect(allCards.locator('.react-flow__handle-right.source')).toHaveCount(STARTER_STEP_COUNT)
  // Every card holds exactly one of each, so none has two of one kind and none of the other.
  await expect(
    allCards.filter({ has: page.locator('.react-flow__handle-left.target') }),
  ).toHaveCount(STARTER_STEP_COUNT)
  await expect(
    allCards.filter({ has: page.locator('.react-flow__handle-right.source') }),
  ).toHaveCount(STARTER_STEP_COUNT)
})

test('the default view with step cards has no accessibility violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})
