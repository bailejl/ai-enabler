import { test, expect } from '@playwright/test'
import { scan } from './axe.js'

const STARTER_STEP_COUNT = 6
const STARTER_EDGE_COUNT = 5

const cardByTitle = (page, title) =>
  page.locator('.react-flow__node').filter({ has: page.getByText(title, { exact: true }) })
const rightHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-right.source')
const leftHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-left.target')
const edges = (page) => page.locator('.react-flow__edge')

const connect = (page, from, to) => rightHandle(page, from).dragTo(leftHandle(page, to))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_STEP_COUNT)
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
})

const edgeBetween = (page, from, to) => page.getByLabel(`Edge from ${from} to ${to}`)

test('connecting Idea to Test adds an edge whose end has an arrowhead marker', async ({ page }) => {
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(0)
  await connect(page, 'Idea', 'Test')
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT + 1)
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(1)
  await expect(edgeBetween(page, 'idea', 'test').locator('.react-flow__edge-path')).toHaveAttribute(
    'marker-end',
    /url\(['"]?#.+\)/,
  )
})

test('Test has two incoming connections once Idea connects to it as well as Build', async ({
  page,
}) => {
  await expect(edgeBetween(page, 'build', 'test')).toHaveCount(1)
  await connect(page, 'Idea', 'Test')
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(1)
  await expect(edgeBetween(page, 'build', 'test')).toHaveCount(1)
})

test.describe('invalid connections leave the edge count unchanged', () => {
  const cases = [
    ['Production right to Plan left (loop)', 'Production', 'Plan'],
    ['Idea right to Plan left (duplicate)', 'Idea', 'Plan'],
    ['Plan right to Plan left (self)', 'Plan', 'Plan'],
  ]
  for (const [name, from, to] of cases) {
    test(name, async ({ page }) => {
      await connect(page, from, to)
      await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
    })
  }

  test('Idea right to empty canvas', async ({ page }) => {
    await rightHandle(page, 'Idea').dragTo(page.locator('.react-flow__pane'), {
      targetPosition: { x: 400, y: 400 },
    })
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
  })

  test('Test left to Build right (target to source)', async ({ page }) => {
    await leftHandle(page, 'Test').dragTo(rightHandle(page, 'Build'))
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
  })
})

test('successive connections use the current edges: exactly two new edges', async ({ page }) => {
  await connect(page, 'Idea', 'Test')
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT + 1)
  await connect(page, 'Idea', 'Deploy')
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT + 2)
  await connect(page, 'Idea', 'Test')
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT + 2)
})

test.describe('handle visibility', () => {
  test('an unconnected handle is hidden, ignores a title hover, and shows on handle hover', async ({
    page,
  }) => {
    const handle = leftHandle(page, 'Idea')
    await expect(handle).toHaveCSS('opacity', '0')
    await cardByTitle(page, 'Idea').getByRole('heading', { name: 'Idea' }).hover()
    await expect(handle).toHaveCSS('opacity', '0')
    await handle.hover()
    await expect(handle).toHaveCSS('opacity', '1')
  })

  test('a connected handle is visible', async ({ page }) => {
    await expect(rightHandle(page, 'Idea')).toHaveCSS('opacity', '1')
  })

  test('every other card shows its left handle while a connection is dragged, then hides unconnected ones on release', async ({
    page,
  }) => {
    const unconnected = leftHandle(page, 'Idea')
    await expect(unconnected).toHaveCSS('opacity', '0')

    const box = await rightHandle(page, 'Idea').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 150, { steps: 5 })

    for (const title of ['Plan', 'Build', 'Test', 'Deploy', 'Production']) {
      await expect(leftHandle(page, title)).toHaveCSS('opacity', '1')
    }

    await page.mouse.up()
    await expect(unconnected).toHaveCSS('opacity', '0')
    await expect(rightHandle(page, 'Production')).toHaveCSS('opacity', '0')
  })
})

test('the default view with connections has no accessibility violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})
