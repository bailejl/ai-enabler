import { test, expect } from '@playwright/test'
import { PAGES_BASE } from '../scripts/pages-base.js'
import { expectHash, expectStarterSteps } from './views.js'

// Runs in the "pages" project, against the production build served under the Pages base.

const currentPath = (page) => page.evaluate(() => window.location.pathname)

test('every asset of the initial load is served under the Pages base', async ({ page }) => {
  const failed = []
  page.on('requestfailed', (request) => failed.push(`failed ${request.url()}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
  })

  await page.goto(`${PAGES_BASE}#/`)
  // The build has one script and one stylesheet, both needed before the cards render.
  await expectStarterSteps(page)

  expect(failed).toEqual([])
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
