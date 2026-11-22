import { parseRecord } from '../src/flow/diagnostics/record.js'

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
