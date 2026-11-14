import { test, expect } from '@playwright/test'
import { scan } from './axe.js'
import { cardByTitle, settledBox } from './canvas.js'

const STARTER_STEP_COUNT = 6

// The badge's visible letters, not its visually hidden name.
const badgeIn = (card, text) => card.getByText(text, { exact: true })

const centerOf = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_STEP_COUNT)
})

test('the Build card shows its title and PT, LT and %C&A values', async ({ page }) => {
  const card = cardByTitle(page, 'Build')
  await expect(card.getByRole('heading', { name: 'Build' })).toBeVisible()
  await expect(card.locator('dd')).toHaveText(['1d', '2d 4h', '90%'])
  await expect(card.locator('dt > [aria-hidden="true"]')).toHaveText(['PT', 'LT', '%C&A'])
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
  const card = cardByTitle(page, 'Build')
  await expect(card.locator('.react-flow__handle')).toHaveCount(2)
  await expect(card.locator('.react-flow__handle-left.target')).toHaveCount(1)
  await expect(card.locator('.react-flow__handle-right.source')).toHaveCount(1)
})

test('the default view with step cards has no accessibility violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})
