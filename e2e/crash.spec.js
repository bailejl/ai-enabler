import { test, expect } from './fixtures.js'
import { DEV_CRASH_EVENT, DEV_CRASH_READY_ATTRIBUTE } from '../src/shell/devCrash.js'
import { scan } from './axe.js'
import { recordsAfter, recordsIn } from './console.js'
import {
  asUpload,
  importAndConfirm,
  openStarterView,
  readFixture,
  replaceQuestion,
} from './views.js'

// Runs in the "chromium" project, against the dev server, where the dev crash event exists.

// Waits for the listener, which attaches in an effect after the first paint.
const forceCrash = async (page, kind) => {
  await page.locator(`html[${DEV_CRASH_READY_ATTRIBUTE}]`).waitFor({ state: 'attached' })
  await page.evaluate(
    ([eventName, detail]) => window.dispatchEvent(new CustomEvent(eventName, { detail })),
    [DEV_CRASH_EVENT, kind],
  )
}

const errorAndWarningMessages = (messages) =>
  messages.filter(({ type }) => type === 'error' || type === 'warning')

test('an uncaught error writes one APP_UNCAUGHT_ERROR record and no other console error', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['APP_UNCAUGHT_ERROR'])
  await openStarterView(page)

  await forceCrash(page, 'error')

  const records = await recordsAfter(page, messages, 1)
  expect(records).toHaveLength(1)
  const [{ type, record }] = records
  expect(type).toBe('error')
  expect(record.code).toBe('APP_UNCAUGHT_ERROR')
  expect(record.error).toEqual({
    name: 'Error',
    message: 'Forced uncaught error',
    stack: expect.any(String),
  })
  expect(errorAndWarningMessages(messages)).toHaveLength(1)
})

test('an unhandled rejection with a string reason writes one APP_UNHANDLED_REJECTION record', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['APP_UNHANDLED_REJECTION'])
  await openStarterView(page)

  await forceCrash(page, 'rejection')

  const records = await recordsAfter(page, messages, 1)
  expect(records).toHaveLength(1)
  const [{ type, record }] = records
  expect(type).toBe('error')
  expect(record.code).toBe('APP_UNHANDLED_REJECTION')
  expect(record.error).toEqual({ name: 'NonError' })
  expect(errorAndWarningMessages(messages)).toHaveLength(1)
})

const SECRET = 'SECRET-MARKER'
const EXPLANATION =
  "The app hit an error and can't continue. Reload to start again; your unsaved map will be lost. If this keeps happening, report the code below."
const NARROW_VIEWPORT = { width: 320, height: 640 }

const mapWithSecretStep = () => {
  const fixture = readFixture('different-name.json')
  const [first, ...rest] = fixture.nodes
  return { ...fixture, nodes: [{ ...first, data: { ...first.data, label: SECRET } }, ...rest] }
}

// Imports a map whose first step is named SECRET, then forces a render crash.
const crashWithSecretOnMap = async (page) => {
  await openStarterView(page)
  await importAndConfirm(page, asUpload(mapWithSecretStep()), replaceQuestion('Checkout Revamp'))
  await expect(page.getByText(SECRET, { exact: true })).toBeVisible()
  await forceCrash(page, 'render')
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
}

test('a render crash shows the crash screen and writes one APP_RENDER_FAILED record', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['APP_RENDER_FAILED'])

  await crashWithSecretOnMap(page)

  const records = await recordsAfter(page, messages, 1)
  expect(records).toHaveLength(1)
  expect(records[0].type).toBe('error')
  expect(records[0].record.code).toBe('APP_RENDER_FAILED')
  expect(errorAndWarningMessages(messages)).toHaveLength(1)
  await expect(page.locator('main')).toHaveCount(1)
  const heading = page.getByRole('heading', { level: 1, name: 'Something went wrong', exact: true })
  await expect(heading).toBeFocused()
  await expect(page.getByText(EXPLANATION, { exact: true })).toBeVisible()
  await expect(page.getByText('Error code: APP_RENDER_FAILED', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('the crash screen shows no map content and the console has none', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages, pageErrors } = capture
  diagnostics.expect(['APP_RENDER_FAILED'])

  await crashWithSecretOnMap(page)

  await recordsAfter(page, messages, 1)
  expect(await page.locator('body').innerText()).not.toContain(SECRET)
  expect(messages.filter(({ text }) => text.includes(SECRET))).toEqual([])
  expect(pageErrors.filter((text) => text.includes(SECRET))).toEqual([])
  expect(recordsIn(messages)).toHaveLength(1)
})

test('the crash screen fits a 320 px wide window', async ({ page, diagnostics }) => {
  diagnostics.expect(['APP_RENDER_FAILED'])
  await page.setViewportSize(NARROW_VIEWPORT)
  await openStarterView(page)

  await forceCrash(page, 'render')

  const reload = page.getByRole('button', { name: 'Reload' })
  await expect(reload).toBeVisible()
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(NARROW_VIEWPORT.width)
  const box = await reload.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width)
  expect(box.y + box.height).toBeLessThanOrEqual(NARROW_VIEWPORT.height)
})

test('Reload brings the map back', async ({ page, diagnostics }) => {
  diagnostics.expect(['APP_RENDER_FAILED'])
  await openStarterView(page)
  await forceCrash(page, 'render')

  await page.getByRole('button', { name: 'Reload' }).click()

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'Value stream map' })).toBeVisible()
})
