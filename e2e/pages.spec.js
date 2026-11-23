import { test, expect } from './fixtures.js'
import { PAGES_BASE } from '../scripts/pages-base.js'
import { RECORD_KEYS } from '../src/flow/diagnostics/record.js'
import { DEV_COMMAND_EVENT, DEV_COMMAND_READY_ATTRIBUTE } from '../src/shell/devCommand.js'
import { CRASH_KIND, DEV_CRASH_EVENT } from '../src/shell/devCrash.js'
import {
  flushConsole,
  ISO_UTC_TIMESTAMP,
  PACKAGE_VERSION,
  waitForRecords,
  recordsIn,
} from './console.js'
import {
  asUpload,
  chooseFile,
  expectHash,
  expectStarterSteps,
  openStarterProject,
} from './views.js'

// Runs in the "pages" project, against the production build served under the Pages base.

// How long to let a refused event have its effect, if it had one.
const SETTLE_MS = 100

const settle = (page) =>
  page.evaluate((ms) => new Promise((done) => setTimeout(done, ms)), SETTLE_MS)

const currentPath = (page) => page.evaluate(() => window.location.pathname)

test('every asset of the initial load is served under the Pages base', async ({ page }) => {
  const failed = []
  const assetPaths = []
  page.on('request', (request) => {
    if (['script', 'stylesheet'].includes(request.resourceType())) {
      assetPaths.push({ type: request.resourceType(), path: new URL(request.url()).pathname })
    }
  })
  page.on('requestfailed', (request) => failed.push(`failed ${request.url()}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
  })

  await openStarterProject(page, { base: PAGES_BASE })
  // The cards render only after the script runs. The listeners above catch a failed or 4xx
  // stylesheet.
  await expectStarterSteps(page)

  expect(failed).toEqual([])
  // A build with the wrong base would request /assets/..., which the preview's SPA fallback
  // can still answer with 200, so check each asset path too.
  expect(new Set(assetPaths.map(({ type }) => type))).toEqual(new Set(['script', 'stylesheet']))
  expect(assetPaths.filter(({ path }) => !path.startsWith(PAGES_BASE))).toEqual([])
})

test('a bare base-path load is normalized and keeps the base path', async ({ page }) => {
  await page.goto(PAGES_BASE)
  await expect(page.getByRole('heading', { level: 1, name: 'AI Enabler' })).toBeVisible()
  expect(await currentPath(page)).toBe(PAGES_BASE)
  await expectHash(page, '#/')
})

test('a project deep link loads directly and after a refresh under the base', async ({ page }) => {
  await openStarterProject(page, { base: PAGES_BASE, id: 'abc' })
  await page.reload()
  await expectStarterSteps(page)
  expect(await currentPath(page)).toBe(PAGES_BASE)
  await expectHash(page, '#/projects/abc')
})

test('a rejected import writes a FILE_NOT_JSON record with build "prod"', async ({
  page,
  capture,
  diagnostics,
}) => {
  const { messages } = capture
  diagnostics.expect(['FILE_NOT_JSON'])
  await openStarterProject(page, { base: PAGES_BASE })
  await expectStarterSteps(page)

  await chooseFile(page, asUpload('this is not json'))

  const records = await waitForRecords(page, messages, 1)
  expect(records).toHaveLength(1)
  const [{ type, record }] = records
  expect(type).toBe('error')
  expect(Object.keys(record)).toEqual(RECORD_KEYS)
  expect(record).toMatchObject({
    code: 'FILE_NOT_JSON',
    version: PACKAGE_VERSION,
    platform: 'browser',
    build: 'prod',
  })
  expect(record.time).toMatch(ISO_UTC_TIMESTAMP)
})

// The text of every script the production build serves on the initial load.
const loadAndReadScripts = async (page, request) => {
  const scriptUrls = new Set()
  page.on('request', (found) => {
    if (found.resourceType() === 'script') scriptUrls.add(found.url())
  })

  await openStarterProject(page, { base: PAGES_BASE })
  await expectStarterSteps(page)

  expect(scriptUrls.size).toBeGreaterThan(0)
  return Promise.all([...scriptUrls].map(async (url) => (await request.get(url)).text()))
}

test('no served JavaScript asset contains the text devDependencies', async ({ page, request }) => {
  const bodies = await loadAndReadScripts(page, request)
  expect(bodies.filter((body) => body.includes('devDependencies'))).toEqual([])
})

test('no served JavaScript asset contains the dev crash event name', async ({ page, request }) => {
  const bodies = await loadAndReadScripts(page, request)
  expect(bodies.filter((body) => body.includes(DEV_CRASH_EVENT))).toEqual([])
})

test('the dev crash event does nothing in production', async ({ page, capture }) => {
  const { messages } = capture
  await openStarterProject(page, { base: PAGES_BASE })
  await expectStarterSteps(page)

  await page.evaluate(
    ([eventName, kinds]) => {
      for (const detail of kinds) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }))
      }
    },
    [DEV_CRASH_EVENT, Object.values(CRASH_KIND)],
  )
  // A timer round trip, so a crash forced from a timer or a rejection would have happened by now.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))

  await expectStarterSteps(page)
  expect(recordsIn(messages)).toEqual([])
})

test('no served JavaScript asset contains the dev command event name or ready attribute', async ({
  page,
  request,
}) => {
  const bodies = await loadAndReadScripts(page, request)
  expect(bodies.filter((body) => body.includes(DEV_COMMAND_EVENT))).toEqual([])
  expect(bodies.filter((body) => body.includes(DEV_COMMAND_READY_ATTRIBUTE))).toEqual([])
})

test('the dev command event does nothing in production', async ({ page, capture }) => {
  const { messages } = capture
  await openStarterProject(page, { base: PAGES_BASE })
  await expectStarterSteps(page)

  await page.evaluate(
    ([eventName]) =>
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { commands: [{ name: 'remove_step', args: { stepId: 'nope' } }] },
        }),
      ),
    [DEV_COMMAND_EVENT],
  )
  await settle(page)
  await flushConsole(page)

  await expectStarterSteps(page)
  await expect(page.getByRole('region', { name: 'Edit problems' })).toHaveCount(0)
  expect(recordsIn(messages)).toEqual([])
})
