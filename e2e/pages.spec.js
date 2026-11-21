import { test, expect } from '@playwright/test'
import { PAGES_BASE } from '../scripts/pages-base.js'
import { expectHash, expectStarterSteps } from './views.js'

// Runs in the "pages" project, against the production build served under the Pages base.

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

  await page.goto(`${PAGES_BASE}#/`)
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
  await expectStarterSteps(page)
  expect(await currentPath(page)).toBe(PAGES_BASE)
  await expectHash(page, '#/')
})

test('a project deep link loads directly and after a refresh under the base', async ({ page }) => {
  await page.goto(`${PAGES_BASE}#/projects/abc`)
  await page.reload()
  await expectStarterSteps(page)
  expect(await currentPath(page)).toBe(PAGES_BASE)
  await expectHash(page, '#/projects/abc')
})
