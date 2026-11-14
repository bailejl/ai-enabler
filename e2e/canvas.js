import { expect } from '@playwright/test'

export const cardByTitle = (page, title) =>
  page.locator('.react-flow__node').filter({ has: page.getByText(title, { exact: true }) })
export const rightHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-right.source')
export const leftHandle = (page, title) =>
  cardByTitle(page, title).locator('.react-flow__handle-left.target')
export const edges = (page) => page.locator('.react-flow__edge')
export const edgeBetween = (page, from, to) => page.getByLabel(`Edge from ${from} to ${to}`)

export const connect = (page, from, to) => rightHandle(page, from).dragTo(leftHandle(page, to))

export const settledBox = async (locator) => {
  await expect(locator).toBeVisible()
  // fitView adjusts the viewport after first render; wait until the box stops moving.
  await expect
    .poll(async () => {
      const a = await locator.boundingBox()
      await locator.page().waitForTimeout(50)
      const b = await locator.boundingBox()
      return a.x === b.x && a.y === b.y && a.width === b.width
    })
    .toBe(true)
  return locator.boundingBox()
}
