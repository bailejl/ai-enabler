import { test, expect } from '@playwright/test'
import { cards, settledBox } from './canvas.js'
import { initialEdges, initialNodes } from '../src/flow/initialFlow.js'

test('value stream canvas shows the starter stages and links', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Untitled Project · AI Enabler')
  await expect(page.getByRole('main')).toHaveAccessibleName('Value stream map')
  await expect(cards(page)).toHaveCount(initialNodes.length)
  await expect(page.locator('.react-flow__edge')).toHaveCount(initialEdges.length)
  await expect(page.getByText('Idea', { exact: true })).toBeVisible()
  await expect(page.getByText('Production', { exact: true })).toBeVisible()
})

const nodeByLabel = (page, label) => cards(page).filter({ hasText: label })

const DRAG_DX = 80
const DRAG_DY = 120

test('a stage can be dragged without moving its neighbours', async ({ page }) => {
  await page.goto('/')
  const dragged = nodeByLabel(page, 'Build')
  const neighbour = nodeByLabel(page, 'Plan')
  const before = await settledBox(dragged)
  const neighbourBefore = await settledBox(neighbour)

  await dragged.hover()
  await page.mouse.down()
  await page.mouse.move(
    before.x + before.width / 2 + DRAG_DX,
    before.y + before.height / 2 + DRAG_DY,
    { steps: 10 },
  )
  await page.mouse.up()

  // fitView may zoom out, so expect at least a third of the screen delta.
  await expect
    .poll(async () => (await dragged.boundingBox()).y)
    .toBeGreaterThan(before.y + DRAG_DY / 3)
  await expect
    .poll(async () => (await dragged.boundingBox()).x)
    .toBeGreaterThan(before.x + DRAG_DX / 3)
  expect(await neighbour.boundingBox()).toEqual(neighbourBefore)
})

test('two stages can be connected by dragging between handles', async ({ page }) => {
  await page.goto('/')
  const edges = page.locator('.react-flow__edge')
  await expect(edges).toHaveCount(initialEdges.length)
  const source = nodeByLabel(page, 'Idea').locator('.react-flow__handle-right.source')
  const target = nodeByLabel(page, 'Production').locator('.react-flow__handle-left.target')
  await source.dragTo(target)
  await expect(edges).toHaveCount(initialEdges.length + 1)
})
