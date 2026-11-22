import { test, expect } from './fixtures.js'
import { RECORD_KEYS } from '../src/flow/diagnostics/record.js'
import { ISO_UTC_TIMESTAMP, PACKAGE_VERSION, recordsAfter, UUID_V4 } from './console.js'
import { asUpload, chooseFile, importStatus, readFixture } from './views.js'

const SECRET = 'SECRET-MARKER'

// Three problems with three different codes: a step with no position, one with a bad process
// time, and one with no id.
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

// The marker is in a step name, and in a value that fails validation.
const markerFile = () => ({
  ...threeProblemFile(),
  nodes: [
    { id: 'a', type: 'step', data: { label: SECRET } },
    { id: 'b', type: 'step', position: { x: 1, y: 1 }, data: { label: 'Second', pt: SECRET } },
  ],
})

const dismissStatus = (page) => importStatus(page).getByRole('button', { name: 'Dismiss' }).click()

test('a file that is not JSON writes exactly one coded error record', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['FILE_NOT_JSON'])
  await page.goto('/')

  const before = Date.now()
  await chooseFile(page, asUpload('this is not json'))

  const records = await recordsAfter(page, messages, 1)
  const after = Date.now()
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
  expect(Date.parse(record.time)).toBeGreaterThanOrEqual(before)
  expect(Date.parse(record.time)).toBeLessThanOrEqual(after)
  expect(record.session).toMatch(UUID_V4)
})

test('a file with three problems writes three records, again on a second import', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(THREE_PROBLEM_CODES)
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

test('records in one page load share version and session', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['FILE_NOT_JSON'])
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  await recordsAfter(page, messages, 1)
  await dismissStatus(page)
  await chooseFile(page, asUpload('{ still not json'))

  const records = await recordsAfter(page, messages, 2)

  expect(records).toHaveLength(2)
  const [first, second] = records.map(({ record }) => record)
  expect(first.session).toMatch(UUID_V4)
  expect(second.session).toBe(first.session)
  expect(second.version).toBe(first.version)
})

test('a reload starts a new session', async ({ page, capture, diagnostics }) => {
  const { messages } = capture
  diagnostics.expect(['FILE_NOT_JSON'])
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  const [{ record: beforeReload }] = await recordsAfter(page, messages, 1)

  await page.reload()
  await chooseFile(page, asUpload('this is not json'))
  const [, { record: afterReload }] = await recordsAfter(page, messages, 2)

  expect(afterReload.session).toMatch(UUID_V4)
  expect(afterReload.session).not.toBe(beforeReload.session)
})

test('a step name from the file never reaches the console', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages, pageErrors } = capture
  diagnostics.expect(['STEP_POSITION_MISSING', 'STEP_COUNT_INVALID'])
  await page.goto('/')

  await chooseFile(page, asUpload(markerFile()))

  await expect(importStatus(page)).toContainText(SECRET)
  const records = await recordsAfter(page, messages, 1)
  expect(records.length).toBeGreaterThan(0)
  expect(messages.map(({ text }) => text).filter((text) => text.includes(SECRET))).toEqual([])
  expect(pageErrors.filter((text) => text.includes(SECRET))).toEqual([])
})
