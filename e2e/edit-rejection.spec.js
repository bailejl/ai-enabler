import { test, expect } from './fixtures.js'
import { DEV_COMMAND_EVENT, DEV_COMMAND_READY_ATTRIBUTE } from '../src/shell/devCommand.js'
import { scan } from './axe.js'
import { cardByTitle, cards, connect } from './canvas.js'
import { recordsIn, waitForRecords } from './console.js'
import {
  asUpload,
  chooseFile,
  importAndConfirm,
  importStatus,
  openStarterView,
  readFixture,
  replaceQuestion,
  STARTER_STEP_COUNT,
  waitForDevHook,
} from './views.js'

// Runs in the "chromium" project, against the dev server, where the dev command event exists.

const NARROW_VIEWPORT = { width: 320, height: 640 }
const MAX_TAB_PRESSES = 40
const NOT_FOUND_MESSAGE = 'The step with id "nope" does not exist.'
const NOT_FOUND_FIX = 'Fix: Use the id of one of the valid steps.'
const NOT_FOUND_ANNOUNCEMENT = `Edit rejected: 1 problem. ${NOT_FOUND_MESSAGE}`

const REMOVE_UNKNOWN_STEP = [{ name: 'remove_step', args: { stepId: 'nope' } }]
// Two problems of two codes: STEP_NAME_EMPTY and STEP_COUNT_INVALID.
const ADD_BAD_STEP = [{ name: 'add_step', args: { name: '', pt: -1 } }]
const NAME_EMPTY_MESSAGE = 'the name (name) must be text that is not empty.'
const COUNT_INVALID_MESSAGE = 'process time (pt) must be a whole number, 0 or more.'

const editPanel = (page) => page.getByRole('region', { name: 'Edit problems' })
const announcer = (page) => page.locator('[aria-live="polite"]')
const canvas = (page) => page.getByRole('main', { name: 'Value stream map' })

const sendEdit = async (page, commands) => {
  await waitForDevHook(page, DEV_COMMAND_READY_ATTRIBUTE)
  await page.evaluate(
    ([eventName, detail]) => window.dispatchEvent(new CustomEvent(eventName, { detail })),
    [DEV_COMMAND_EVENT, { commands }],
  )
}

// A timer round trip, so an edit sent before it has been handled and rendered when it returns.
const settle = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))

// Records the text of the live region after every change, so a clear and a set both count.
const recordLiveRegionTexts = async (page) => {
  await announcer(page).waitFor({ state: 'attached' })
  await page.evaluate(() => {
    const region = document.querySelector('[aria-live="polite"]')
    window.liveRegionTexts = []
    new MutationObserver(() => window.liveRegionTexts.push(region.textContent)).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
}
const liveRegionTexts = (page) => page.evaluate(() => window.liveRegionTexts)

// Presses `key` until `locator` has focus.
const tabTo = async (page, locator, key) => {
  for (let presses = 0; presses < MAX_TAB_PRESSES; presses += 1) {
    await page.keyboard.press(key)
    if (await locator.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error(`${key} did not reach the element in ${MAX_TAB_PRESSES} presses`)
}

const dismissButton = (page) =>
  editPanel(page).getByRole('button', { name: 'Dismiss Edit problems' })

test.beforeEach(async ({ page }) => {
  await openStarterView(page)
})

test('a rejected edit is announced and listed, and nothing changes', async ({
  page,
  capture,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NOT_FOUND'])

  await sendEdit(page, REMOVE_UNKNOWN_STEP)

  await expect(announcer(page)).toContainText(NOT_FOUND_ANNOUNCEMENT)
  const panel = editPanel(page)
  await expect(panel.getByRole('heading', { name: 'Edit rejected: 1 problem' })).toBeVisible()
  await expect(panel.getByRole('listitem')).toHaveCount(1)
  await expect(panel.getByRole('listitem')).toContainText(NOT_FOUND_MESSAGE)
  await expect(panel.getByRole('listitem')).toContainText(NOT_FOUND_FIX)
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  // The record carries the code and no text from the map or the command.
  const records = await waitForRecords(page, capture.messages, 1)
  expect(records.map(({ record }) => record.code)).toEqual(['STEP_NOT_FOUND'])
  const recordText = JSON.stringify(records)
  for (const secret of ['nope', 'Idea', 'Plan', 'Build', 'Test', 'Deploy', 'Production']) {
    expect(recordText).not.toContain(secret)
  }
})

test('a rejected edit does not move focus', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await cardByTitle(page, 'Build').focus()
  await expect(cardByTitle(page, 'Build')).toBeFocused()

  await sendEdit(page, REMOVE_UNKNOWN_STEP)

  await expect(editPanel(page)).toBeVisible()
  await expect(cardByTitle(page, 'Build')).toBeFocused()
})

test('the same rejection twice is announced twice', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(announcer(page)).toContainText(NOT_FOUND_ANNOUNCEMENT)
  await recordLiveRegionTexts(page)

  await sendEdit(page, REMOVE_UNKNOWN_STEP)

  await expect.poll(() => liveRegionTexts(page)).toHaveLength(2)
  const [cleared, spoken] = await liveRegionTexts(page)
  expect(cleared).toBe('')
  expect(spoken).toContain(NOT_FOUND_ANNOUNCEMENT)
})

test('a later rejection replaces the list', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND', 'STEP_NAME_EMPTY', 'STEP_COUNT_INVALID'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page).getByRole('listitem')).toContainText(NOT_FOUND_MESSAGE)

  await sendEdit(page, ADD_BAD_STEP)

  const panel = editPanel(page)
  await expect(panel.getByRole('heading', { name: 'Edit rejected: 2 problems' })).toBeVisible()
  const items = panel.getByRole('listitem')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText(NAME_EMPTY_MESSAGE)
  await expect(items.nth(1)).toContainText(COUNT_INVALID_MESSAGE)
  await expect(panel).not.toContainText(NOT_FOUND_MESSAGE)
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
})

test('the next accepted edit clears the list', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page)).toBeVisible()

  await connect(page, 'Idea', 'Test')

  await expect(editPanel(page)).toHaveCount(0)
})

test('selecting a step does not clear the list', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page)).toBeVisible()

  await cardByTitle(page, 'Build').click()

  await expect(cardByTitle(page, 'Build')).toHaveClass(/selected/)
  await expect(editPanel(page)).toBeVisible()
})

test('a confirmed import clears the list', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page)).toBeVisible()

  await importAndConfirm(
    page,
    asUpload(readFixture('different-name.json')),
    replaceQuestion('Checkout Revamp'),
  )

  await expect(editPanel(page)).toHaveCount(0)
})

test('Dismiss closes the list and returns focus to the step that had it', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await cardByTitle(page, 'Build').focus()
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page)).toBeVisible()

  await tabTo(page, dismissButton(page), 'Shift+Tab')
  await page.keyboard.press('Enter')

  await expect(editPanel(page)).toHaveCount(0)
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  await expect(cardByTitle(page, 'Build')).toBeFocused()
})

test('Dismiss returns focus to the canvas when focus was on the page', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await page.evaluate(() => document.activeElement.blur())
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await expect(editPanel(page)).toBeVisible()

  await tabTo(page, dismissButton(page), 'Tab')
  await page.keyboard.press('Enter')

  await expect(editPanel(page)).toHaveCount(0)
  await expect(canvas(page)).toBeFocused()
})

test('an accepted edit while focus is in the list moves focus to the canvas', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await dismissButton(page).focus()
  await expect(dismissButton(page)).toBeFocused()

  await sendEdit(page, [{ name: 'connect', args: { sourceId: 'idea', targetId: 'test' } }])

  await expect(editPanel(page)).toHaveCount(0)
  await expect(canvas(page)).toBeFocused()
})

test('Dismiss after a rejection sent while focus was in the list returns focus to the canvas', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NOT_FOUND'])
  await cardByTitle(page, 'Build').focus()
  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await dismissButton(page).focus()

  await sendEdit(page, REMOVE_UNKNOWN_STEP)
  await page.keyboard.press('Enter')

  await expect(editPanel(page)).toHaveCount(0)
  await expect(canvas(page)).toBeFocused()
})

// A valid map file whose steps all lack a position: one problem per step, so more than the panel
// lists.
const FILE_WITH_MANY_PROBLEMS = () => ({
  ...readFixture('same-name.json'),
  nodes: Array.from({ length: 14 }, (_, index) => ({
    id: `step-${index}`,
    type: 'step',
    data: { label: `Step ${index}` },
  })),
  edges: [],
})

test('two long panels at 320 px wide scroll inside and leave the canvas near the top', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NAME_EMPTY', 'STEP_COUNT_INVALID', 'STEP_POSITION_MISSING'])
  await page.setViewportSize(NARROW_VIEWPORT)
  const zoomIn = page.getByRole('button', { name: 'Zoom In' })
  const before = await zoomIn.boundingBox()

  await sendEdit(page, ADD_BAD_STEP)
  await chooseFile(page, asUpload(FILE_WITH_MANY_PROBLEMS()))
  await expect(importStatus(page)).toContainText('and 4 more')
  await expect(editPanel(page)).toBeVisible()

  // The controls moved down by the panels' height only: each list scrolls inside a capped box.
  const after = await zoomIn.boundingBox()
  expect(after.y - before.y).toBeLessThan(NARROW_VIEWPORT.height / 2)
  await expect(zoomIn).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    NARROW_VIEWPORT.width,
  )
})

test('an edit rejected with 2 problems writes 2 records and no step name', async ({
  page,
  capture,
  diagnostics,
}) => {
  diagnostics.expect(['STEP_NAME_EMPTY', 'STEP_COUNT_INVALID'])

  await sendEdit(page, ADD_BAD_STEP)

  const records = await waitForRecords(page, capture.messages, 2)
  expect(records.map(({ record }) => record.code)).toEqual([
    'STEP_NAME_EMPTY',
    'STEP_COUNT_INVALID',
  ])
  expect(recordsIn(capture.messages)).toHaveLength(2)
  const recordText = JSON.stringify(records)
  for (const stepName of ['Idea', 'Plan', 'Build', 'Test', 'Deploy', 'Production']) {
    expect(recordText).not.toContain(stepName)
  }
})

test('the rejected-edit view has no axe violations', async ({ page, diagnostics }) => {
  diagnostics.expect(['STEP_NAME_EMPTY', 'STEP_COUNT_INVALID'])
  await sendEdit(page, ADD_BAD_STEP)
  await expect(editPanel(page).getByRole('listitem')).toHaveCount(2)

  expect(await scan(page)).toEqual([])
})

test('an unknown command is rejected by the command layer and listed', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['CMD_UNKNOWN'])

  await sendEdit(page, [{ name: 'frobnicate', args: {} }])

  await expect(editPanel(page).getByRole('listitem')).toContainText('Unknown command frobnicate.')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
})

test.describe('the dev command hook refuses', () => {
  for (const [label, commands] of [
    ['no commands', []],
    ['a create_project command', [{ name: 'create_project', args: { name: 'Other' } }]],
  ]) {
    test(label, async ({ page, capture }) => {
      await sendEdit(page, commands)
      await settle(page)

      await expect(editPanel(page)).toHaveCount(0)
      await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
      await expect(page.getByText('Other', { exact: true })).toHaveCount(0)
      expect(recordsIn(capture.messages)).toEqual([])
    })
  }
})
