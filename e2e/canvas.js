import { expect } from '@playwright/test'

export const cards = (page) => page.locator('.react-flow__node')
export const cardByTitle = (page, title) =>
  cards(page).filter({ has: page.getByText(title, { exact: true }) })
export const rightHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-right.source')
export const leftHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-left.target')
export const edges = (page) => page.locator('.react-flow__edge')
export const edgeBetween = (page, from, to) => page.getByLabel(`Edge from ${from} to ${to}`)

export const connect = (page, from, to) => rightHandle(page, from).dragTo(leftHandle(page, to))

// Selects a connection by clicking its midpoint; hold `modifier` to add it to the selection.
export const selectEdge = async (page, from, to, modifier) => {
  const edge = edgeBetween(page, from, to)
  // The interaction path is an invisible stroke (flat for a straight edge), so Playwright's
  // actionability checks reject a locator click; click its midpoint after checking what is there.
  const box = await edge.locator('.react-flow__edge-interaction').boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const labelAtPoint = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__edge')?.ariaLabel,
    point,
  )
  expect(labelAtPoint).toBe(`Edge from ${from} to ${to}`)
  if (modifier) await page.keyboard.down(modifier)
  await page.mouse.click(point.x, point.y)
  if (modifier) await page.keyboard.up(modifier)
  await expect(edge).toHaveClass(/selected/)
}

const isSameBox = (a, b) =>
  a !== null &&
  b !== null &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height

export const settledBox = async (locator) => {
  await expect(locator).toBeVisible()
  // fitView adjusts the viewport after first render; wait until the box stops moving.
  await expect
    .poll(async () => {
      const before = await locator.boundingBox()
      await locator.page().waitForTimeout(50)
      return isSameBox(before, await locator.boundingBox())
    })
    .toBe(true)
  return locator.boundingBox()
}

const centerOf = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 })

// A point on the pane below the lowest card, midway to the pane's bottom edge.
const emptyPointBelowCards = async (page) => {
  const cardBoxes = await Promise.all(
    (await cards(page).all()).map(async (card) => settledBox(card)),
  )
  const lowestBottom = Math.max(...cardBoxes.map(({ y, height }) => y + height))
  const pane = await settledBox(page.locator('.react-flow__pane'))
  return { x: pane.x + pane.width / 2, y: (lowestBottom + pane.y + pane.height) / 2 }
}

// Presses on a handle's centre and moves to an empty point without releasing; the caller releases.
export const dragHandleOverEmptyCanvas = async (page, handle) => {
  const { x, y } = centerOf(await settledBox(handle))
  const target = await emptyPointBelowCards(page)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
}

export const dragHandleToEmptyCanvas = async (page, handle) => {
  await dragHandleOverEmptyCanvas(page, handle)
  await page.mouse.up()
}
