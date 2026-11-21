import { test, expect } from '@playwright/test'
import { PAGES_BASE } from '../scripts/pages-base.js'
import { currentHash, expectStarterSteps } from './views.js'

// Runs in the "pages" project, against the production build served under the Pages base.

const currentPath = (page) => page.evaluate(() => window.location.pathname)

test('every asset of the initial load is served under the Pages base', async ({ page }) => {
  const failed = []
  page.on('requestfailed', (request) => failed.push(`failed ${request.url()}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
  })

  await page.goto(`${PAGES_BASE}#/`)
  await expectStarterSteps(page)
  await page.waitForLoadState('networkidle')

  expect(failed).toEqual([])
})

test('a bare base-path load is normalized and keeps the base path', async ({ page }) => {
  await page.goto(PAGES_BASE)
  await expectStarterSteps(page)
  expect(await currentPath(page)).toBe(PAGES_BASE)
  expect(await currentHash(page)).toBe('#/')
})

test('a project deep link loads directly and after a refresh under the base', async ({ page }) => {
  await page.goto(`${PAGES_BASE}#/projects/abc`)
  await page.reload()
  await expectStarterSteps(page)
  expect(await currentPath(page)).toBe(PAGES_BASE)
  expect(await currentHash(page)).toBe('#/projects/abc')
})
