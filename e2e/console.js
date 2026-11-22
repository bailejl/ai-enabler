import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { parseRecord } from '../src/flow/diagnostics/record.js'

export const { version: PACKAGE_VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
export const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Collects what a page writes to the console and the errors it raises. Call it before the first
// `page.goto` so nothing from the load is missed. `messages` and `pageErrors` fill as events arrive.
export const collectConsole = (page) => {
  const messages = []
  const pageErrors = []
  page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }))
  page.on('pageerror', (error) => pageErrors.push(error.message))
  return { messages, pageErrors }
}

// The `aie` records among the collected messages, each with the console method it came through.
export const recordsIn = (messages) =>
  messages.flatMap(({ type, text }) => {
    const record = parseRecord(text)
    return record ? [{ type, record }] : []
  })

// A round trip to the page. Console events sent before it have reached Node when it returns.
export const flushConsole = (page) => page.evaluate(() => undefined)

// Waits until `count` records have arrived, then lets any later console events land.
export const waitForRecords = async (page, messages, count) => {
  await expect.poll(() => recordsIn(messages).length).toBeGreaterThanOrEqual(count)
  await flushConsole(page)
  return recordsIn(messages)
}
