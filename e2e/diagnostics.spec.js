import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { RECORD_KEYS } from '../src/flow/diagnostics/record.js'
import { collectConsole, flushConsole, recordsIn } from './console.js'
import { asUpload, chooseFile, importStatus, readFixture } from './views.js'

const { version: PACKAGE_VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SECRET = 'SECRET-MARKER'

// Three problems with three different codes: a step with no position, one with a bad process
// time, and one with no id. The marker is in a step name and in a value.
const threeProblemFile = () => ({
  ...readFixture('same-name.json'),
  nodes: [
    { id: 'a', type: 'step', data: { label: 'First' } },
    { id: 'b', type: 'step', position: { x: 1, y: 1 }, data: { label: 'Second', pt: 'bad' } },
    { type: 'step', position: { x: 1, y: 1 }, data: { label: 'Third' } },
  ],
  edges: [],
})
const THREE_PROBLEM_CODES = ['STEP_POSITION_MISSING', 'STEP_COUNT_INVALID', 'STEP_ID_MISSING']

const markerFile = () => ({
  ...threeProblemFile(),
  nodes: [{ id: 'a', type: 'step', data: { label: SECRET } }],
})

const dismissStatus = (page) => importStatus(page).getByRole('button', { name: 'Dismiss' }).click()

// Waits until `count` records have arrived, then lets any later console events land.
const recordsAfter = async (page, messages, count) => {
  await expect.poll(() => recordsIn(messages).length).toBeGreaterThanOrEqual(count)
  await flushConsole(page)
  return recordsIn(messages)
}

test('a file that is not JSON writes exactly one coded error record', async ({ page }) => {
  const { messages } = collectConsole(page)
  await page.goto('/')

  await chooseFile(page, asUpload('this is not json'))

  const records = await recordsAfter(page, messages, 1)
  expect(records).toHaveLength(1)
  const [{ type, record }] = records
  expect(type).toBe('error')
  expect(Object.keys(record)).toEqual(RECORD_KEYS)
  expect(record).toMatchObject({
    source: 'aie',
    code: 'FILE_NOT_JSON',
    severity: 'error',
    version: PACKAGE_VERSION,
    platform: 'browser',
    build: 'dev',
  })
  expect(record.time).toMatch(ISO_UTC_TIMESTAMP)
  expect(record.session).toMatch(UUID_V4)
})

test('a file with three problems writes three records, again on a second import', async ({
  page,
}) => {
  const { messages } = collectConsole(page)
  await page.goto('/')

  await chooseFile(page, asUpload(threeProblemFile()))
  const afterFirst = await recordsAfter(page, messages, 3)
  expect(afterFirst.map(({ record }) => record.code)).toEqual(THREE_PROBLEM_CODES)

  await dismissStatus(page)
  await chooseFile(page, asUpload(threeProblemFile()))
  const afterSecond = await recordsAfter(page, messages, 6)
  expect(afterSecond.map(({ record }) => record.code)).toEqual([
    ...THREE_PROBLEM_CODES,
    ...THREE_PROBLEM_CODES,
  ])
})

test('records in one page load share version and session, and a reload changes the session', async ({
  page,
}) => {
  const { messages } = collectConsole(page)
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  await recordsAfter(page, messages, 1)
  await dismissStatus(page)
  await chooseFile(page, asUpload('{ still not json'))
  const beforeReload = await recordsAfter(page, messages, 2)

  await page.reload()
  await chooseFile(page, asUpload('this is not json'))
  const afterReload = await recordsAfter(page, messages, 3)

  const [first, second, third] = afterReload.map(({ record }) => record)
  expect(beforeReload).toHaveLength(2)
  expect(second.session).toBe(first.session)
  expect(second.version).toBe(first.version)
  expect(third.session).toMatch(UUID_V4)
  expect(third.session).not.toBe(first.session)
})

test('a step name from the file never reaches the console', async ({ page }) => {
  const { messages, pageErrors } = collectConsole(page)
  await page.goto('/')

  await chooseFile(page, asUpload(markerFile()))

  await expect(importStatus(page)).toContainText(SECRET)
  const records = await recordsAfter(page, messages, 1)
  expect(records.length).toBeGreaterThan(0)
  expect(messages.map(({ text }) => text).filter((text) => text.includes(SECRET))).toEqual([])
  expect(pageErrors.filter((text) => text.includes(SECRET))).toEqual([])
})
