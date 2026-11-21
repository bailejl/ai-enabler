import { test, expect } from '@playwright/test'
import { cards } from './canvas.js'
import {
  STARTER_STEP_COUNT,
  appShell,
  expectHash,
  expectRoute,
  expectStarterSteps,
} from './views.js'

const setHash = (page, hash) =>
  page.evaluate((next) => {
    window.location.hash = next
  }, hash)

const historyLength = (page) => page.evaluate(() => window.history.length)

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

test('the home and project routes render the same shell', async ({ context }) => {
  const shellMarkup = async (address) => {
    const page = await context.newPage()
    await page.goto(address)
    await expectStarterSteps(page)
    const markup = await appShell(page).innerHTML()
    await page.close()
    return markup
  }
  expect(await shellMarkup('/#/projects/abc123')).toBe(await shellMarkup('/#/'))
})

test('a project id with reserved characters is not rewritten', async ({ page }) => {
  await page.goto('/#/projects/a@b')
  // The cards render after the mount effect has run, so a rewrite would already show.
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/a@b')
})

for (const address of [
  '/',
  '/#',
  '/#/nowhere',
  '/#/projects/',
  '/#/projects/abc/extra',
  '/#/projects/abc//',
  '/#/projects/%E0%A4%A',
]) {
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

test('a trailing slash on a project link is dropped', async ({ page }) => {
  await page.goto('/#/projects/abc123/')
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/abc123')
})

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
