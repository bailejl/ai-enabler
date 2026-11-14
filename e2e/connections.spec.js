import { test, expect } from '@playwright/test'
import { scan } from './axe.js'
import {
  cardByTitle,
  cards,
  connect,
  dragHandleOverEmptyCanvas,
  dragHandleToEmptyCanvas,
  edgeBetween,
  edges,
  leftHandle,
  rightHandle,
  selectEdge,
} from './canvas.js'
import { STARTER_STEP_COUNT } from './views.js'

const STARTER_EDGE_COUNT = 5
const MIN_HANDLE_HIT_SIZE = 20

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
})

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
  // The control connect proves the drag mechanics work, so a misfiring drag cannot pass these.
  const expectRejectedThenValidConnectionAdds = async (page, attemptRejectedDrag) => {
    await attemptRejectedDrag()
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT)
    await connect(page, 'Idea', 'Test')
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT + 1)
  }

  const cases = [
    ['Production right to Plan left (loop)', 'Production', 'Plan'],
    ['Idea right to Plan left (duplicate)', 'Idea', 'Plan'],
    ['Plan right to Plan left (self)', 'Plan', 'Plan'],
  ]
  for (const [name, from, to] of cases) {
    test(name, async ({ page }) => {
      await expectRejectedThenValidConnectionAdds(page, () => connect(page, from, to))
    })
  }

  test('Idea right to empty canvas', async ({ page }) => {
    await expectRejectedThenValidConnectionAdds(page, () =>
      dragHandleToEmptyCanvas(page, rightHandle(page, 'Idea')),
    )
  })

  test('Test left to Build right (target to source)', async ({ page }) => {
    await expectRejectedThenValidConnectionAdds(page, () =>
      leftHandle(page, 'Test').dragTo(rightHandle(page, 'Build')),
    )
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

  test('a handle hit area is at least 20 by 20 pixels', async ({ page }) => {
    // Layout size: the canvas zoom scales the on-screen box, not the CSS hit area.
    const { width, height } = await rightHandle(page, 'Idea').evaluate((handle) => ({
      width: handle.offsetWidth,
      height: handle.offsetHeight,
    }))
    expect(width).toBeGreaterThanOrEqual(MIN_HANDLE_HIT_SIZE)
    expect(height).toBeGreaterThanOrEqual(MIN_HANDLE_HIT_SIZE)
  })

  test('every other card shows its left handle while a connection is dragged, then hides unconnected ones on release', async ({
    page,
  }) => {
    // Free Build's and Deploy's left handles so the drag has hidden handles to reveal.
    await selectEdge(page, 'plan', 'build')
    await page.keyboard.press('Delete')
    await selectEdge(page, 'test', 'deploy')
    await page.keyboard.press('Delete')
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT - 2)

    const buildLeft = leftHandle(page, 'Build')
    const deployLeft = leftHandle(page, 'Deploy')
    await expect(buildLeft).toHaveCSS('opacity', '0')
    await expect(deployLeft).toHaveCSS('opacity', '0')

    await dragHandleOverEmptyCanvas(page, rightHandle(page, 'Idea'))
    await expect(leftHandle(page, 'Plan')).toHaveCSS('opacity', '1')
    await expect(buildLeft).toHaveCSS('opacity', '1')
    await expect(leftHandle(page, 'Test')).toHaveCSS('opacity', '1')
    await expect(deployLeft).toHaveCSS('opacity', '1')
    await expect(leftHandle(page, 'Production')).toHaveCSS('opacity', '1')

    await page.mouse.up()
    await expect(buildLeft).toHaveCSS('opacity', '0')
    await expect(deployLeft).toHaveCSS('opacity', '0')
    await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT - 2)
  })
})

const selectStep = async (page, title) => {
  await cardByTitle(page, title).click()
  await expect(cardByTitle(page, title)).toHaveClass(/selected/)
}

test.describe('selected items are deleted with either key', () => {
  for (const key of ['Delete', 'Backspace']) {
    test(`${key} removes the selected Plan to Build edge and hides the handles it frees`, async ({
      page,
    }) => {
      await selectEdge(page, 'plan', 'build')
      await page.keyboard.press(key)
      await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT - 1)
      await expect(edgeBetween(page, 'plan', 'build')).toHaveCount(0)
      await expect(rightHandle(page, 'Plan')).toHaveCSS('opacity', '0')
      await expect(leftHandle(page, 'Build')).toHaveCSS('opacity', '0')
    })

    test(`${key} removes the selected Build step with its connections and hides the handles they free`, async ({
      page,
    }) => {
      await selectStep(page, 'Build')
      await page.keyboard.press(key)
      await expect(cardByTitle(page, 'Build')).toHaveCount(0)
      await expect(page.locator('.react-flow__edge[aria-label*="build"]')).toHaveCount(0)
      await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT - 2)
      await expect(rightHandle(page, 'Plan')).toHaveCSS('opacity', '0')
      await expect(leftHandle(page, 'Test')).toHaveCSS('opacity', '0')
    })
  }
})

test('deleting a connection from the keyboard moves focus to the step it started from', async ({
  page,
}) => {
  await selectEdge(page, 'plan', 'build')
  await page.keyboard.press('Backspace')
  await expect(edgeBetween(page, 'plan', 'build')).toHaveCount(0)

  await expect(cardByTitle(page, 'Plan')).toBeFocused()
})

test('a handle with another connection stays visible after one of its edges is deleted', async ({
  page,
}) => {
  await connect(page, 'Idea', 'Test')
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(1)
  await selectEdge(page, 'idea', 'test')
  await page.keyboard.press('Delete')
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(0)
  await expect(edgeBetween(page, 'idea', 'plan')).toHaveCount(1)
  await expect(rightHandle(page, 'Idea')).toHaveCSS('opacity', '1')
})

test('the default view with connections has no accessibility violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})
