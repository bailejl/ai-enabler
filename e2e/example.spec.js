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

test('a stage can be dragged to a new position', async ({ page }) => {
  await page.goto('/')
  const node = page.locator('.react-flow__node').filter({ hasText: 'Build' })
  const before = await node.boundingBox()
  await node.hover()
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 120, {
    steps: 10,
  })
  await page.mouse.up()
  const after = await node.boundingBox()
  expect(after.y).toBeGreaterThan(before.y + 50)
})
