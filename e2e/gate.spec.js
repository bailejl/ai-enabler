import { serializeRecord, toErrorRecord } from '../src/flow/diagnostics/record.js'
import { cards, settledBox } from './canvas.js'
import { expect, test } from './fixtures.js'
import {
  asUpload,
  chooseFile,
  fixturePath,
  importAndConfirm,
  openStarterView,
  replaceQuestion,
} from './views.js'

const NOT_JSON = 'this is not json'
const CRASH_RECORD_CONTEXT = {
  version: '0.1.0',
  session: 'gate-spec',
  platform: 'browser',
  build: 'dev',
  time: '2026-11-22T00:00:00.000Z',
}
const SETTLE_MS = 100

// Raises an uncaught error or an unhandled rejection from a timer, as a page would. When
// `handler` is a record's text, the page handles the event the way the app's global handler does:
// it calls preventDefault and writes that record to the console.
const raise = (page, { kind, handler }) =>
  page.evaluate(
    ({ kind: eventKind, handler: recordText }) => {
      const eventName = eventKind === 'error' ? 'error' : 'unhandledrejection'
      if (recordText) {
        window.addEventListener(eventName, (event) => {
          event.preventDefault()
          window.console.error(recordText)
        })
      }
      setTimeout(() => {
        if (eventKind === 'error') throw new Error('raised by gate.spec')
        Promise.reject(new Error('raised by gate.spec'))
      }, 0)
    },
    { kind, handler },
  )

// Resolves after the raising timer has run and the browser had time to report what it raised.
const settle = (page) =>
  page.evaluate((ms) => new Promise((done) => setTimeout(done, ms)), SETTLE_MS)

const crashRecordText = (code) =>
  serializeRecord(toErrorRecord(code, new Error('raised by gate.spec'), CRASH_RECORD_CONTEXT))

// The page errors Chromium reports for a page that has no handler at all, and for one whose
// handler calls preventDefault. `browser.newPage()` is outside the gate, so it can raise freely.
const pageErrorsFrom = async (browser, { kind, handled }) => {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await raise(page, { kind, handler: handled ? 'handled' : undefined })
  await settle(page)
  await page.close()
  return pageErrors
}

test.describe('Chromium page errors after preventDefault (AC10 Rule A)', () => {
  for (const kind of ['error', 'rejection']) {
    test(`an unhandled ${kind} raises a page error`, async ({ browser }) => {
      const pageErrors = await pageErrorsFrom(browser, { kind, handled: false })

      expect(pageErrors).toEqual(['raised by gate.spec'])
    })

    test(`an ${kind} whose handler calls preventDefault raises no page error`, async ({
      browser,
    }) => {
      const pageErrors = await pageErrorsFrom(browser, { kind, handled: true })

      expect(pageErrors).toEqual([])
    })
  }
})

test.describe('the diagnostics gate', () => {
  test('an expected record passes', async ({ page, diagnostics }) => {
    diagnostics.expect(['FILE_NOT_JSON'])
    await page.goto('/')

    await chooseFile(page, asUpload(NOT_JSON))
  })

  test('an unexpected record fails the test', async ({ page }) => {
    test.fail()
    await page.goto('/')

    await chooseFile(page, asUpload(NOT_JSON))
  })

  test('a declared code that is never written fails the test', async ({ page, diagnostics }) => {
    test.fail()
    diagnostics.expect(['FILE_NOT_JSON'])
    await page.goto('/')
  })

  test('a handled uncaught error with its expected record passes', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['APP_UNCAUGHT_ERROR'])
    await page.goto('/')

    await raise(page, { kind: 'error', handler: crashRecordText('APP_UNCAUGHT_ERROR') })
    await settle(page)
  })

  test('an uncaught error nothing handled fails the test', async ({ page, capture }) => {
    test.fail()
    await page.goto('/')

    await raise(page, { kind: 'error' })
    await expect.poll(() => capture.pageErrors.length).toBeGreaterThan(0)
  })

  test('an uncoded console error fails the test', async ({ page }) => {
    test.fail()
    await page.goto('/')

    await page.evaluate(() => window.console.error('not a record'))
  })

  test('an uncoded console warning fails the test', async ({ page }) => {
    test.fail()
    await page.goto('/')

    await page.evaluate(() => window.console.warn('not a record'))
  })

  test('normal canvas use writes no diagnostics', async ({ page }) => {
    await openStarterView(page)

    // The app has no add-step control, so a valid import changes the steps.
    await importAndConfirm(
      page,
      fixturePath('different-name.json'),
      replaceQuestion('Checkout Revamp'),
    )
    const card = cards(page).first()
    const box = await settledBox(card)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 5 })
    await page.mouse.up()
    await page.mouse.wheel(0, -200)
    await page.setViewportSize({ width: 800, height: 600 })
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(card).toBeVisible()
  })
})
