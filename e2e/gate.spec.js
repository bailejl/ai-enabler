import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import catalog from '../src/flow/diagnostics/catalog.json' with { type: 'json' }
import { serializeRecord, toErrorRecord } from '../src/flow/diagnostics/record.js'
import { cards, settledBox } from './canvas.js'
import { collectConsole } from './console.js'
import { expect, gateFailures, test } from './fixtures.js'
import {
  asUpload,
  chooseFile,
  fixturePath,
  importAndConfirm,
  openStarterView,
  replaceQuestion,
  openStarterProject,
} from './views.js'

const NOT_JSON = 'this is not json'
const RAISED_MESSAGE = 'raised by gate.spec'
const HANDLED_TEXT = 'handled by gate.spec'
const CRASH_RECORD_CONTEXT = {
  version: '0.1.0',
  session: 'gate-spec',
  platform: 'browser',
  build: 'dev',
  time: '2026-11-22T00:00:00.000Z',
}
const SETTLE_MS = 100
const DRAG_OFFSET = { x: 60, y: 40 }
const WHEEL_DELTA_Y = -200
const NARROW_VIEWPORT = { width: 800, height: 600 }
const WIDE_VIEWPORT = { width: 1280, height: 720 }
const { severity: NOT_JSON_SEVERITY, fix: NOT_JSON_FIX } = catalog.FILE_NOT_JSON

// Raises an uncaught error or an unhandled rejection from a timer, as a page would. When
// `handledText` is given, the page handles the event the way the app's global handler does: it
// calls preventDefault and writes that text to the console.
const raise = (page, { kind, handledText }) =>
  page.evaluate(
    ({ kind: eventKind, handledText: handled, message }) => {
      const eventName = eventKind === 'error' ? 'error' : 'unhandledrejection'
      if (handled) {
        window.addEventListener(eventName, (event) => {
          event.preventDefault()
          window.console.error(handled)
        })
      }
      setTimeout(() => {
        if (eventKind === 'error') throw new Error(message)
        Promise.reject(new Error(message))
      }, 0)
    },
    { kind, handledText, message: RAISED_MESSAGE },
  )

// Resolves after a short grace period, so a report that arrives late is not missed by an assertion
// that nothing was reported.
const settle = (page) =>
  page.evaluate((ms) => new Promise((done) => setTimeout(done, ms)), SETTLE_MS)

const crashRecordText = (code) =>
  serializeRecord(toErrorRecord(code, new Error(RAISED_MESSAGE), CRASH_RECORD_CONTEXT))

// The page errors Chromium reports for a page that has no handler at all, and for one whose
// handler calls preventDefault. `browser.newPage()` is outside the gate, so it can raise freely.
const pageErrorsFrom = async (browser, { kind, handled }) => {
  const page = await browser.newPage()
  try {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const handlerRan = handled ? page.waitForEvent('console') : undefined
    await Promise.all([
      raise(page, { kind, handledText: handled ? HANDLED_TEXT : undefined }),
      handlerRan,
    ])
    if (!handled) await expect.poll(() => pageErrors.length).toBeGreaterThan(0)
    await settle(page)
    return pageErrors
  } finally {
    await page.close()
  }
}

// A spare page in the test's context with its own collector, outside the test's gate, so a test
// can read the gate's verdict on it. `expected` is the codes this page's run declares. `url` is
// `about:blank` for a page that must not run the app, whose global handlers would catch an error.
const spareGatePage = async (context, expected = [], url = '/') => {
  const page = await context.newPage()
  const ledger = { ...collectConsole(page), expected }
  await page.goto(url)
  return { page, ledger }
}

test.describe('Chromium page errors after preventDefault (AC10 Rule A)', () => {
  for (const kind of ['error', 'rejection']) {
    test(`an unhandled ${kind} raises a page error`, async ({ browser }) => {
      const pageErrors = await pageErrorsFrom(browser, { kind, handled: false })

      expect(pageErrors).toEqual([RAISED_MESSAGE])
    })

    test(`an ${kind} whose handler calls preventDefault raises no page error`, async ({
      browser,
    }) => {
      const pageErrors = await pageErrorsFrom(browser, { kind, handled: true })

      expect(pageErrors).toEqual([])
    })
  }
})

test.describe('the diagnostics gate passes', () => {
  test('an expected record', async ({ page, diagnostics }) => {
    diagnostics.expect(['FILE_NOT_JSON'])
    await openStarterProject(page)

    await chooseFile(page, asUpload(NOT_JSON))
  })

  test('a handled uncaught error with its expected record', async ({ page, diagnostics }) => {
    diagnostics.expect(['APP_UNCAUGHT_ERROR'])
    await openStarterProject(page)

    await raise(page, { kind: 'error', handledText: crashRecordText('APP_UNCAUGHT_ERROR') })
    await settle(page)
  })

  test('normal canvas use, with no records and no page errors', async ({ page, capture }) => {
    await openStarterView(page)

    // The app has no add-step control, so a valid import changes the steps.
    await importAndConfirm(
      page,
      fixturePath('different-name.json'),
      replaceQuestion('Checkout Revamp'),
    )
    const card = cards(page).first()
    const box = await settledBox(card)
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(centre.x, centre.y)
    await page.mouse.down()
    await page.mouse.move(centre.x + DRAG_OFFSET.x, centre.y + DRAG_OFFSET.y, { steps: 5 })
    await page.mouse.up()
    await page.mouse.wheel(0, WHEEL_DELTA_Y)
    await page.setViewportSize(NARROW_VIEWPORT)
    await page.setViewportSize(WIDE_VIEWPORT)
    await expect(card).toBeVisible()
    // The gate checks the test's console and page errors when the test ends; a late timer error
    // would land after that, so give one a chance to show.
    await settle(page)
    expect(capture.pageErrors).toEqual([])
  })
})

test.describe('the diagnostics gate reports', () => {
  test('an unexpected record with its severity and fix line', async ({ context }) => {
    const { page, ledger } = await spareGatePage(context)
    await openStarterProject(page)

    await chooseFile(page, asUpload(NOT_JSON))
    await expect.poll(() => ledger.messages.length).toBeGreaterThan(0)

    expect(await gateFailures(page, ledger)).toEqual([
      `unexpected FILE_NOT_JSON (${NOT_JSON_SEVERITY}): ${NOT_JSON_FIX}`,
    ])
  })

  test('a declared code that was never written', async ({ context }) => {
    const { page, ledger } = await spareGatePage(context, ['FILE_NOT_JSON'])

    expect(await gateFailures(page, ledger)).toEqual(['expected FILE_NOT_JSON was not seen'])
  })

  test('an uncoded console error', async ({ context }) => {
    const { page, ledger } = await spareGatePage(context)

    await page.evaluate(() => window.console.error('not a record'))

    expect(await gateFailures(page, ledger)).toEqual(['uncoded error: not a record'])
  })

  test('an uncoded console warning', async ({ context }) => {
    const { page, ledger } = await spareGatePage(context)

    await page.evaluate(() => window.console.warn('not a record'))

    expect(await gateFailures(page, ledger)).toEqual(['uncoded warn: not a record'])
  })

  test('an uncaught error nothing handled, with its text', async ({ context }) => {
    const { page, ledger } = await spareGatePage(context, [], 'about:blank')

    await raise(page, { kind: 'error' })
    await expect.poll(() => ledger.pageErrors.length).toBeGreaterThan(0)

    expect(await gateFailures(page, ledger)).toEqual([`page error: ${RAISED_MESSAGE}`])
  })
})

// The fixture skips the gate once a test has already failed, and test.fail() passes on any
// failure, so neither shows that the gate itself failed a test. A child run of the self-test
// config (e2e/gate-wiring.selftest.js) does: its report says which tests failed and with what.
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SELFTEST_CONFIG = 'playwright.selftest.config.js'
const SELFTEST_TIMEOUT_MS = 60_000

const testsIn = (suite) => [
  ...(suite.specs ?? []).flatMap((spec) =>
    spec.tests.map(({ results }) => ({
      title: spec.title,
      status: results.at(-1).status,
      message: results
        .at(-1)
        .errors.map(({ message }) => message)
        .join('\n'),
    })),
  ),
  ...(suite.suites ?? []).flatMap(testsIn),
]

const runGateSelfTest = (baseURL) => {
  // Nothing from this run's worker (Playwright's own PW_ settings) may reach the child.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('PW_')),
  )
  const child = spawnSync('npx', ['playwright', 'test', '-c', SELFTEST_CONFIG, '--reporter=json'], {
    cwd: REPO_ROOT,
    env: { ...env, GATE_SELFTEST_BASE_URL: baseURL, NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: SELFTEST_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  })
  // The tests fail on purpose, so the exit code says nothing; the report does.
  if (!child.stdout) {
    throw new Error(`self-test run wrote no report (${child.error?.message}): ${child.stderr}`)
  }
  return Object.fromEntries(
    JSON.parse(child.stdout)
      .suites.flatMap(testsIn)
      .map((result) => [result.title, result]),
  )
}

test('the test fixture fails a test that breaks the gate', async ({ baseURL }) => {
  test.setTimeout(SELFTEST_TIMEOUT_MS + 30_000)

  const outcomes = runGateSelfTest(baseURL)

  expect(outcomes['that wrote an undeclared record']).toMatchObject({
    status: 'failed',
    message: expect.stringContaining(
      `unexpected FILE_NOT_JSON (${NOT_JSON_SEVERITY}): ${NOT_JSON_FIX}`,
    ),
  })
  expect(outcomes['that wrote an uncoded console error']).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('uncoded error: not a record'),
  })
})
