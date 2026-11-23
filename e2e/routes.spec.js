import { test, expect } from './fixtures.js'
import { scan } from './axe.js'
import { cards } from './canvas.js'
import { readIndex, readStored, seedProjects } from './store.js'
import {
  STARTER_STEP_COUNT,
  expectHash,
  expectRoute,
  expectStarterSteps,
  openStarterProject,
  starterRecordAs,
  withoutHash,
} from './views.js'

const setHash = (page, hash) =>
  page.evaluate((next) => {
    window.location.hash = next
  }, hash)

const historyLength = (page) => page.evaluate(() => window.history.length)

const homeHeading = (page) => page.getByRole('heading', { level: 1, name: 'AI Enabler' })

test('these route tests run against the Vite dev server at the root', async ({ page }) => {
  await page.goto('/#/')
  await expect(homeHeading(page)).toBeVisible()
  // Only the dev server injects the Vite client; a production build does not.
  await expect(page.locator('script[src="/@vite/client"]')).toHaveCount(1)
})

test('the home route shows the homepage, titled AI Enabler', async ({ page }) => {
  await page.goto('/#/')
  await expect(homeHeading(page)).toBeVisible()
  await expectHash(page, '#/')
  await expectRoute(page, 'home')
  await expect(page).toHaveTitle('AI Enabler')
})

test('a saved project link survives a direct load and a refresh', async ({ page }) => {
  await openStarterProject(page, { id: 'abc123' })
  await page.reload()
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/abc123')
  await expectRoute(page, 'project')
  await expect(page).toHaveTitle('Untitled Project · AI Enabler')
})

test.describe('a project link with no saved project', () => {
  test('shows "Project not found" with a home link and reports it once', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await page.goto('/#/projects/nope')
    const heading = page.getByRole('heading', { level: 1, name: 'Project not found' })
    await expect(heading).toBeFocused()
    await expect(page).toHaveTitle('Project not found · AI Enabler')
    await expectHash(page, '#/projects/nope')
    await page.getByRole('link', { name: 'Go to the homepage' }).click()
    await expect(homeHeading(page)).toBeVisible()
    await expectHash(page, '#/')
  })

  test('shows an id with markup as text and never in the problem', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    const id = '<img src=x onerror=alert(1)>'
    await page.goto(`/#/projects/${encodeURIComponent(id)}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Project not found' })).toBeVisible()
    await expect(page.locator('img')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Project problems' })).not.toContainText(id)
  })

  test('has no accessibility violations and its home link works by keyboard', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_PROJECT_NOT_FOUND'])
    await page.goto('/#/projects/nope')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    expect(await scan(page)).toEqual([])
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Go to the homepage' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(homeHeading(page)).toBeVisible()
  })
})

test.describe('a saved project whose file cannot be opened', () => {
  const brokenRecord = {
    id: 'broken',
    name: 'Broken',
    modifiedAt: '2026-11-22T10:00:00.000Z',
    text: JSON.stringify({
      schemaVersion: '0.1.0',
      exportedAt: '2026-11-22T10:00:00.000Z',
      project: { id: 'broken', name: 'Broken' },
      nodes: [{ id: 's1', type: 'step', data: { label: 'Plan' } }],
      edges: [],
    }),
  }

  test('shows "Can\'t open Broken" and lists STORE_FILE_INVALID first', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STORE_FILE_INVALID', 'STEP_POSITION_MISSING'])
    await page.goto('/#/')
    await seedProjects(page, [brokenRecord])
    await page.goto('/#/projects/broken')
    await expect(page.getByRole('heading', { level: 1, name: "Can't open Broken" })).toBeFocused()
    await expect(page).toHaveTitle("Can't open Broken · AI Enabler")
    const items = page.getByRole('region', { name: 'Project problems' }).getByRole('listitem')
    await expect(items.first()).toContainText("The saved copy of this project can't be opened.")
    await expect(items).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Go to the homepage' })).toBeVisible()
  })

  test('has no accessibility violations', async ({ page, diagnostics }) => {
    diagnostics.expect(['STORE_FILE_INVALID', 'STEP_POSITION_MISSING'])
    await page.goto('/#/')
    await seedProjects(page, [brokenRecord])
    await page.goto('/#/projects/broken')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    expect(await scan(page)).toEqual([])
  })
})

test('opening a file saved at an older schema upgrades it and writes nothing', async ({ page }) => {
  const record = await starterRecordAs('old')
  const file = JSON.parse(record.text)
  const unhashed = withoutHash(file)
  const old = { ...record, text: JSON.stringify({ ...unhashed, schemaVersion: '0.0.0' }) }
  await page.goto('/#/')
  await seedProjects(page, [old])
  await page.goto('/#/projects/old')
  await expectStarterSteps(page)
  await page.reload()
  await expectStarterSteps(page)
  expect(await readStored(page, 'old')).toBe(old.text)
  const [entry] = await readIndex(page)
  expect(entry.modifiedAt).toBe(old.modifiedAt)
})

test('a project id with reserved characters is not rewritten', async ({ page }) => {
  await page.goto('/#/')
  await seedProjects(page, [await starterRecordAs('a@b')])
  await page.goto('/#/projects/a@b')
  // The cards render after the mount effect has run, so a rewrite would already show.
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/a@b')
})

// One case per kind in AC8: no hash, an empty hash, an unknown hash. The malformed project
// links are covered by the resolveHash table in src/shell/routes.test.js.
for (const address of ['/', '/#', '/#/nowhere']) {
  test(`"${address}" becomes the home route without a new history entry`, async ({ context }) => {
    const fresh = await context.newPage()
    await fresh.goto('/#/')
    await expect(homeHeading(fresh)).toBeVisible()
    const expectedLength = await historyLength(fresh)
    await fresh.close()

    const page = await context.newPage()
    await page.goto(address)
    await expect(homeHeading(page)).toBeVisible()
    await expectHash(page, '#/')
    expect(await historyLength(page)).toBe(expectedLength)
  })
}

test('a trailing slash on a project link is dropped', async ({ page }) => {
  await openStarterProject(page, { id: 'abc123' })
  await setHash(page, '#/projects/abc123/')
  await expectStarterSteps(page)
  await expectHash(page, '#/projects/abc123')
  await expectRoute(page, 'project')
})

test('back and forward switch the route without a reload', async ({ page }) => {
  await openStarterProject(page, { id: 'abc123' })
  await expectStarterSteps(page)
  await page.evaluate(() => {
    window.__routeMarker = 'kept'
  })

  await setHash(page, '#/')
  await expectRoute(page, 'home')
  await page.goBack()
  await expectRoute(page, 'project')
  await expectHash(page, '#/projects/abc123')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  await page.goForward()
  await expectRoute(page, 'home')

  expect(await page.evaluate(() => window.__routeMarker)).toBe('kept')
})

test('an address change to an unknown hash is replaced in place', async ({ page }) => {
  await openStarterProject(page, { id: 'abc123' })
  await expectRoute(page, 'project')

  await setHash(page, '#/nowhere')
  await expectRoute(page, 'home')
  await expectHash(page, '#/')

  await page.goBack()
  await expectRoute(page, 'project')
  await expectHash(page, '#/projects/abc123')
})
