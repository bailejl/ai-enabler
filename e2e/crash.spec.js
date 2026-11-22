import { test, expect } from './fixtures.js'
import { DEV_CRASH_EVENT } from '../src/shell/devCrash.js'
import { recordsAfter } from './console.js'
import { openStarterView } from './views.js'

// Runs in the "chromium" project, against the dev server, where the dev crash event exists.

const forceCrash = (page, kind) =>
  page.evaluate(
    ([eventName, detail]) => window.dispatchEvent(new CustomEvent(eventName, { detail })),
    [DEV_CRASH_EVENT, kind],
  )

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
