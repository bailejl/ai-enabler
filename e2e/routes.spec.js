import { test, expect } from '@playwright/test'
import { cards } from './canvas.js'
import { STARTER_STEP_COUNT, expectHash, expectRoute, expectStarterSteps } from './views.js'

const setHash = (page, hash) =>
  page.evaluate((next) => {
    window.location.hash = next
  }, hash)

const historyLength = (page) => page.evaluate(() => window.history.length)

test('these route tests run against the Vite dev server at the root', async ({ page }) => {
  await page.goto('/#/')
  await expectStarterSteps(page)
  // Only the dev server injects the Vite client; a production build does not.
  await expect(page.locator('script[src="/@vite/client"]')).toHaveCount(1)
})

test('the home route renders the shell', async ({ page }) => {
  await page.goto('/#/')
  await expectStarterSteps(page)
  await expectHash(page, '#/')
  await expectRoute(page, 'home')
})

test('a project deep link survives a direct load and a refresh', async ({ page }) => {
  await page.goto('/#/projects/abc123')
  await page.reload()
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/abc123')
  await expectRoute(page, 'project')
})

test('an unknown project id still renders the app shell', async ({ page }) => {
  await page.goto('/#/projects/does-not-exist')
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/does-not-exist')
})

test('the home and project routes render the same steps', async ({ context }) => {
  const stepLabels = async (address) => {
    const page = await context.newPage()
    await page.goto(address)
    await expectStarterSteps(page)
    const labels = await cards(page).allTextContents()
    await page.close()
    return labels
  }
  expect(await stepLabels('/#/projects/abc123')).toEqual(await stepLabels('/#/'))
})

test('a project id with reserved characters is not rewritten', async ({ page }) => {
  await page.goto('/#/projects/a@b')
  // The cards render after the mount effect has run, so a rewrite would already show.
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/a@b')
})

// One case per kind in AC8: no hash, an empty hash, an unknown hash. The malformed project
// links and the trailing slash are covered by the resolveHash table in src/shell/routes.test.js.
for (const address of ['/', '/#', '/#/nowhere']) {
  test(`"${address}" becomes the home route without a new history entry`, async ({ context }) => {
    const fresh = await context.newPage()
    await fresh.goto('/#/')
    await expectStarterSteps(fresh)
    const expectedLength = await historyLength(fresh)
    await fresh.close()

    const page = await context.newPage()
    await page.goto(address)
    await expectStarterSteps(page)
    await expectHash(page, '#/')
    expect(await historyLength(page)).toBe(expectedLength)
  })
}

test('back and forward switch the route without a reload', async ({ page }) => {
  await page.goto('/#/')
  await expectStarterSteps(page)
  await cards(page).first().click()
  await page.keyboard.press('Backspace')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
  await page.evaluate(() => {
    window.__routeMarker = 'kept'
  })

  await setHash(page, '#/projects/abc123')
  await expectRoute(page, 'project')
  await page.goBack()
  await expectRoute(page, 'home')
  await expectHash(page, '#/')
  await page.goForward()
  await expectRoute(page, 'project')

  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
  expect(await page.evaluate(() => window.__routeMarker)).toBe('kept')
})

test('an address change to an unknown hash is replaced in place', async ({ page }) => {
  await page.goto('/#/projects/abc123')
  await expectRoute(page, 'project')

  await setHash(page, '#/nowhere')
  await expectRoute(page, 'home')
  await expectHash(page, '#/')

  await page.goBack()
  await expectRoute(page, 'project')
  await expectHash(page, '#/projects/abc123')
})
