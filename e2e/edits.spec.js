import { test, expect } from './fixtures.js'
import {
  boxSelect,
  cardByTitle,
  cards,
  connect,
  dragStep,
  edgeBetween,
  edges,
  pressArrow,
  selectEdge,
  settledBox,
  viewportZoom,
} from './canvas.js'
import {
  exportProjectFile,
  fixturePath,
  importAndConfirm,
  metricRegion,
  openStarterView,
  readFixture,
  replaceQuestion,
  STARTER_STEP_COUNT,
} from './views.js'

const STARTER_EDGE_COUNT = 5
// Plan to Build and Build to Test go with Build; Idea to Plan is deleted with it.
const REMOVED_EDGE_COUNT = 3
const ARROW_STEP = 5
const DRAG_OFFSET = { x: 60, y: 90 }
const MULTI_SELECT_KEY = 'ControlOrMeta'

const positionsById = (file) =>
  Object.fromEntries(file.nodes.map(({ id, position }) => [id, position]))
const hasConnection = (file, source, target) =>
  file.edges.some((edge) => edge.source === source && edge.target === target)

// A position moved by a screen-pixel offset, in the map's own units; fractions below a unit are
// the pointer's rounding.
const expectMovedBy = (after, before, offset, zoom) => {
  expect(after.x).toBeCloseTo(before.x + offset.x / zoom, 0)
  expect(after.y).toBeCloseTo(before.y + offset.y / zoom, 0)
}

test.beforeEach(async ({ page }) => {
  await openStarterView(page)
})

test('dropping a dragged step stores its position and no other step moves', async ({ page }) => {
  const before = positionsById(await exportProjectFile(page))
  await dragStep(page, 'Build', DRAG_OFFSET)
  const zoom = await viewportZoom(page)

  const after = positionsById(await exportProjectFile(page))
  expectMovedBy(after.build, before.build, DRAG_OFFSET, zoom)
  for (const id of Object.keys(before).filter((stepId) => stepId !== 'build')) {
    expect(after[id], id).toEqual(before[id])
  }
})

test('dragging a box selection moves each selected step by the drag offset and no other', async ({
  page,
}) => {
  const before = positionsById(await exportProjectFile(page))
  await boxSelect(page, 'Plan', 'Build')
  await expect(cardByTitle(page, 'Idea')).not.toHaveClass(/selected/)
  await expect(cardByTitle(page, 'Test')).not.toHaveClass(/selected/)
  await dragStep(page, 'Plan', DRAG_OFFSET)
  const zoom = await viewportZoom(page)

  const after = positionsById(await exportProjectFile(page))
  expectMovedBy(after.plan, before.plan, DRAG_OFFSET, zoom)
  expectMovedBy(after.build, before.build, DRAG_OFFSET, zoom)
  for (const id of ['idea', 'test', 'deploy', 'production']) {
    expect(after[id], id).toEqual(before[id])
  }
})

test('an arrow-key move is kept when a later connection rebuilds the canvas', async ({ page }) => {
  const before = positionsById(await exportProjectFile(page))
  await cardByTitle(page, 'Build').click()
  await expect(cardByTitle(page, 'Build')).toHaveClass(/selected/)
  await pressArrow(page, 'ArrowRight')
  await connect(page, 'Idea', 'Test')
  await expect(edgeBetween(page, 'idea', 'test')).toHaveCount(1)

  const file = await exportProjectFile(page)
  expect(positionsById(file).build).toEqual({ x: before.build.x + ARROW_STEP, y: before.build.y })
  expect(hasConnection(file, 'idea', 'test')).toBe(true)
  expect(file.edges).toHaveLength(STARTER_EDGE_COUNT + 1)
})

test('clicking a step without dragging changes nothing in an export', async ({ page }) => {
  const before = await exportProjectFile(page)
  await cardByTitle(page, 'Build').click()
  await expect(cardByTitle(page, 'Build')).toHaveClass(/selected/)

  const after = await exportProjectFile(page)
  expect(after.nodes).toEqual(before.nodes)
  expect(after.edges).toEqual(before.edges)
  expect(after.project).toEqual(before.project)
})

test('a map replaced by import is the project: a later connection keeps its steps, and all fit', async ({
  page,
}) => {
  const imported = readFixture('different-name.json')
  await importAndConfirm(
    page,
    fixturePath('different-name.json'),
    replaceQuestion('Checkout Revamp'),
  )
  await expect(cards(page)).toHaveCount(imported.nodes.length)
  await connect(page, 'Intake', 'Ship')
  await expect(edgeBetween(page, 'intake', 'ship')).toHaveCount(1)

  const file = await exportProjectFile(page)
  expect(file.nodes.map(({ id }) => id)).toEqual(imported.nodes.map(({ id }) => id))
  expect(file.edges).toHaveLength(imported.edges.length + 1)
  expect(hasConnection(file, 'intake', 'ship')).toBe(true)
  const canvas = await settledBox(page.getByRole('main'))
  for (const card of await cards(page).all()) {
    const box = await settledBox(card)
    const title = await card.getAttribute('data-id')
    expect(box.x, `${title} left`).toBeGreaterThanOrEqual(canvas.x)
    expect(box.y, `${title} top`).toBeGreaterThanOrEqual(canvas.y)
    expect(box.x + box.width, `${title} right`).toBeLessThanOrEqual(canvas.x + canvas.width)
    expect(box.y + box.height, `${title} bottom`).toBeLessThanOrEqual(canvas.y + canvas.height)
  }
})

test('deleting Build with the Idea to Plan connection removes both and moves focus on', async ({
  page,
}) => {
  await cardByTitle(page, 'Build').click()
  await selectEdge(page, 'idea', 'plan', MULTI_SELECT_KEY)
  await page.keyboard.press('Delete')

  await expect(cardByTitle(page, 'Build')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
  await expect(edgeBetween(page, 'idea', 'plan')).toHaveCount(0)
  await expect(edges(page)).toHaveCount(STARTER_EDGE_COUNT - REMOVED_EDGE_COUNT)
  await expect(
    metricRegion(page).locator('.metric', { hasText: 'Steps' }).locator('dd'),
  ).toHaveText(String(STARTER_STEP_COUNT - 1))
  await expect(cardByTitle(page, 'Test')).toBeFocused()
  const file = await exportProjectFile(page)
  expect(file.nodes.map(({ id }) => id)).toEqual(['idea', 'plan', 'test', 'deploy', 'production'])
  expect(file.edges.map(({ source, target }) => `${source}>${target}`)).toEqual([
    'test>deploy',
    'deploy>production',
  ])
})
