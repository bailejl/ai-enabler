import { test, expect } from '@playwright/test'
import { initialEdges, initialNodes } from '../src/flow/initialFlow.js'

test('value stream canvas shows the starter stages and links', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('ai-enabler')
  await expect(page.getByRole('main')).toHaveAccessibleName('Value stream map')
  await expect(page.locator('.react-flow__node')).toHaveCount(initialNodes.length)
  await expect(page.locator('.react-flow__edge')).toHaveCount(initialEdges.length)
  await expect(page.getByText('Idea', { exact: true })).toBeVisible()
  await expect(page.getByText('Production', { exact: true })).toBeVisible()
})

const DRAG_DX = 80
const DRAG_DY = 120

const settledBox = async (locator) => {
  await expect(locator).toBeVisible()
  // fitView adjusts the viewport after first render; wait until the box stops moving.
  await expect
    .poll(async () => {
      const a = await locator.boundingBox()
      await locator.page().waitForTimeout(50)
      const b = await locator.boundingBox()
      return a.x === b.x && a.y === b.y
    })
    .toBe(true)
  return locator.boundingBox()
}

test('a stage can be dragged without moving its neighbours', async ({ page }) => {
  await page.goto('/')
  const nodeByLabel = (label) => page.locator('.react-flow__node').filter({ hasText: label })
  const dragged = nodeByLabel('Build')
  const neighbour = nodeByLabel('Plan')
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
  const nodeByLabel = (label) => page.locator('.react-flow__node').filter({ hasText: label })
  const source = nodeByLabel('Idea').locator('.react-flow__handle.source')
  const target = nodeByLabel('Production').locator('.react-flow__handle.target')
  await source.dragTo(target)
  await expect(edges).toHaveCount(initialEdges.length + 1)
})
