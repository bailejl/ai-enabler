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

// The viewport's scale: how many screen pixels one unit of a step's position takes.
export const viewportZoom = (page) =>
  page.evaluate(() => {
    const { a } = new DOMMatrixReadOnly(
      getComputedStyle(document.querySelector('.react-flow__viewport')).transform,
    )
    return a
  })

// React Flow starts a drag at the first pointer move, so that move's distance is not carried.
const DRAG_START_PX = 3

// Presses on a point, makes the move that starts the drag, then moves by `offset` pixels in steps
// and drops, so the step ends up `offset` pixels from where it started.
const dragFrom = async (page, point, offset) => {
  const start = { x: point.x + DRAG_START_PX, y: point.y + DRAG_START_PX }
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y)
  await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 5 })
  await page.mouse.up()
}

// Drags a step's card by `offset` screen pixels and drops it.
export const dragStep = async (page, title, offset) =>
  dragFrom(page, centerOf(await settledBox(cardByTitle(page, title))), offset)

// Selects the steps `from` to `to` (left to right, one row) with a box drawn from the empty pane
// above the first card to below the last, and waits for both ends to show as selected.
export const boxSelect = async (page, from, to) => {
  const first = await settledBox(cardByTitle(page, from))
  const last = await settledBox(cardByTitle(page, to))
  await page.keyboard.down('Shift')
  await page.mouse.move(first.x - 4, first.y - 20)
  await page.mouse.down()
  await page.mouse.move(last.x + last.width + 4, last.y + last.height + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(cardByTitle(page, from)).toHaveClass(/selected/)
  await expect(cardByTitle(page, to)).toHaveClass(/selected/)
}

// Presses an arrow key; React Flow moves the selected step that has focus.
export const pressArrow = (page, key) => page.keyboard.press(key)
