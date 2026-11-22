import { test, expect } from './fixtures.js'
import { contrastRatio } from '../src/shell/contrast.js'
import { tokens } from '../src/shell/tokens.js'
import { scan } from './axe.js'
import { cardByTitle, edgeBetween, selectEdge } from './canvas.js'
import {
  asUpload,
  chooseFile,
  confirmDialog,
  deleteAllSteps,
  EMPTY_MAP_MESSAGE,
  fixturePath,
  importAndConfirm,
  importStatus,
  metricRegion,
  openAllHelpSections,
  openBadgesView,
  openStarterView,
  replaceQuestion,
} from './views.js'

const MULTI_SELECT_KEY = 'ControlOrMeta'
const MIN_FOCUS_OUTLINE_PX = 2
const MIN_NON_TEXT_CONTRAST = 3
const MIN_FOCUS_STROKE_PX = 3
const MAX_TAB_PRESSES = 40
const MAX_DIALOG_TAB_PRESSES = 6
const NARROW_VIEWPORT = { width: 320, height: 640 }
const STACKING_BREAKPOINT_WIDTH = 640
const LONG_PROJECT_NAME_LENGTH = 100
const IMPORT_BUTTON_NAME = 'Import project (JSON)'
const EXPORT_BUTTON_NAME = 'Export project (JSON)'

const namedButton = (page, name) => page.getByRole('button', { name, exact: true })

const expectNoViolations = async (page) => expect(await scan(page)).toEqual([])

test('the default view has no axe violations', async ({ page }) => {
  await openStarterView(page)
  await expectNoViolations(page)
})

test('all three help sections expanded have no axe violations', async ({ page }) => {
  await openStarterView(page)
  await openAllHelpSections(page)
  await expectNoViolations(page)
})

test('an import error has no axe violations', async ({ page, diagnostics }) => {
  diagnostics.expect(['FILE_NOT_JSON'])
  await openStarterView(page)
  await chooseFile(page, asUpload('this is not json'))
  await expect(importStatus(page)).toContainText('This file is not valid JSON.')
  await expectNoViolations(page)
})

test('the import confirmation open has no axe violations', async ({ page }) => {
  await openStarterView(page)
  await chooseFile(page, fixturePath('different-name.json'))
  await expect(confirmDialog(page)).toBeVisible()
  await expectNoViolations(page)
})

test('the empty map has no axe violations', async ({ page }) => {
  await openStarterView(page)
  await deleteAllSteps(page)
  await expect(page.locator('.canvas__empty')).toHaveText(EMPTY_MAP_MESSAGE)
  await expectNoViolations(page)
})

test('an imported map with On target and Needs attention tiles has no axe violations', async ({
  page,
}) => {
  await openStarterView(page)
  await importAndConfirm(
    page,
    fixturePath('on-target-and-needs-attention.json'),
    replaceQuestion('Status Check'),
  )
  await expect(metricRegion(page).getByText('On target').first()).toBeVisible()
  await expect(metricRegion(page).getByText('Needs attention').first()).toBeVisible()
  await expectNoViolations(page)
})

test('an imported map with queue and batch badges and a Watch tile has no axe violations', async ({
  page,
}) => {
  await openBadgesView(page)
  await expect(cardByTitle(page, 'Badged').locator('.badge')).toHaveCount(2)
  await expect(metricRegion(page).getByText('Watch').first()).toBeVisible()
  await expectNoViolations(page)
})

test('a selected step and a selected connection have no axe violations', async ({ page }) => {
  await openStarterView(page)
  await cardByTitle(page, 'Plan').click()
  await selectEdge(page, 'build', 'test', MULTI_SELECT_KEY)
  await expect(cardByTitle(page, 'Plan')).toHaveClass(/selected/)
  await expect(edgeBetween(page, 'build', 'test')).toHaveClass(/selected/)
  await expectNoViolations(page)
})

const toRgbString = (hex) => {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return `rgb(${red}, ${green}, ${blue})`
}

// Each stop names the surface token behind its ring, and the identity React Flow or the DOM
// gives it when focused. Card, edge and control rings are drawn outside the element, on the
// canvas (the controls panel has no fill of its own); the dialog buttons sit on the dialog card.
const focusStops = [
  {
    name: 'the Import button',
    identity: IMPORT_BUTTON_NAME,
    surface: 'headerBackground',
    find: (page) => namedButton(page, IMPORT_BUTTON_NAME),
  },
  {
    name: 'the Export button',
    identity: EXPORT_BUTTON_NAME,
    surface: 'headerBackground',
    find: (page) => namedButton(page, EXPORT_BUTTON_NAME),
  },
  ...['How to use', 'Glossary', 'Help'].map((title) => ({
    name: `the ${title} help summary`,
    identity: title,
    surface: 'menuBackground',
    find: (page) => page.locator('summary', { hasText: title }),
  })),
  {
    name: 'the Plan card',
    identity: 'Plan',
    surface: 'pageBackground',
    find: (page) => cardByTitle(page, 'Plan'),
  },
  {
    name: 'the build to test connection',
    identity: 'Edge from build to test',
    surface: 'pageBackground',
    find: (page) => edgeBetween(page, 'build', 'test'),
  },
  ...['Zoom In', 'Zoom Out', 'Fit View', 'Toggle Interactivity'].map((label) => ({
    name: `the ${label} control`,
    identity: label,
    surface: 'pageBackground',
    find: (page) => namedButton(page, label),
  })),
  ...['Replace map', 'Cancel'].map((label) => ({
    name: `the ${label} dialog button`,
    identity: label,
    surface: 'cardBackground',
    opensDialog: true,
    find: (page) => confirmDialog(page).getByRole('button', { name: label }),
  })),
]

const mainPageStops = focusStops.filter((stop) => !stop.opensDialog)
const dialogStops = focusStops.filter((stop) => stop.opensDialog)

const openConfirmation = async (page) => {
  await chooseFile(page, fixturePath('different-name.json'))
  await expect(confirmDialog(page)).toBeVisible()
}

// What the focused element is called: its accessible name (cards are named by step title), else its React Flow node id, else its text.
const activeIdentity = (page) =>
  page.evaluate(() => {
    const element = document.activeElement
    return element.getAttribute('aria-label') ?? element.dataset.id ?? element.textContent.trim()
  })

const tabIdentities = async (page, presses) => {
  const identities = []
  for (let press = 0; press < presses; press += 1) {
    await page.keyboard.press('Tab')
    identities.push(await activeIdentity(page))
  }
  return identities
}

const isActive = (locator) => locator.evaluate((element) => element === document.activeElement)

// Tabs from wherever focus is until the locator holds it, so :focus-visible matches as it does for a user.
const focusByKeyboard = async (page, locator) => {
  for (let press = 0; press < MAX_TAB_PRESSES && !(await isActive(locator)); press += 1) {
    await page.keyboard.press('Tab')
  }
  await expect(locator).toBeFocused()
}

const readOutline = (locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      isFocusVisible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor,
    }
  })

// The ring is drawn outside the element, so the surface behind it is the nearest ancestor with a fill.
const readSurfaceBehind = (locator) =>
  locator.evaluate((element) => {
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const { backgroundColor } = getComputedStyle(ancestor)
      if (backgroundColor !== 'rgba(0, 0, 0, 0)') return backgroundColor
    }
    return null
  })

test.describe('the keyboard reaches every control', () => {
  test('tabbing the main page visits the header, help menu, a card, a connection and the controls', async ({
    page,
  }) => {
    await openStarterView(page)
    const visited = await tabIdentities(page, MAX_TAB_PRESSES)
    expect(visited).toEqual(expect.arrayContaining(mainPageStops.map((stop) => stop.identity)))
  })

  test('tabbing the import confirmation visits both of its buttons', async ({ page }) => {
    await openStarterView(page)
    await openConfirmation(page)
    const visited = await tabIdentities(page, MAX_DIALOG_TAB_PRESSES)
    expect(visited).toEqual(expect.arrayContaining(dialogStops.map((stop) => stop.identity)))
  })
})

test.describe('every control shows a visible focus indicator', () => {
  for (const { name, surface, opensDialog, find } of focusStops) {
    test(`${name} has a solid 2px+ ring with 3:1 contrast on ${surface}`, async ({ page }) => {
      await openStarterView(page)
      if (opensDialog) await openConfirmation(page)
      await focusByKeyboard(page, find(page))

      const outline = await readOutline(find(page))
      const surfaceBehind = await readSurfaceBehind(find(page))

      expect(outline.isFocusVisible).toBe(true)
      expect(outline.style).toBe('solid')
      expect(outline.width).toBeGreaterThanOrEqual(MIN_FOCUS_OUTLINE_PX)
      expect(outline.color).toBe(toRgbString(tokens.focusRing))
      expect(surfaceBehind).toBe(toRgbString(tokens[surface]))
      expect(contrastRatio(tokens.focusRing, tokens[surface])).toBeGreaterThanOrEqual(
        MIN_NON_TEXT_CONTRAST,
      )
    })
  }

  test('a focused connection also recolors its stroke to the focus ring', async ({ page }) => {
    await openStarterView(page)
    const edge = edgeBetween(page, 'build', 'test')
    await focusByKeyboard(page, edge)

    const path = await edge.locator('.react-flow__edge-path').evaluate((element) => ({
      isFocusVisible: element.closest('.react-flow__edge').matches(':focus-visible'),
      stroke: getComputedStyle(element).stroke,
      width: parseFloat(getComputedStyle(element).strokeWidth),
    }))

    expect(path.isFocusVisible).toBe(true)
    expect(path.stroke).toBe(toRgbString(tokens.focusRing))
    expect(path.width).toBeGreaterThanOrEqual(MIN_FOCUS_STROKE_PX)
  })
})

const horizontalOverflow = (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

const expectNoHorizontalScroll = async (page) => {
  const { scrollWidth, clientWidth } = await horizontalOverflow(page)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test.describe('the page reflows at 320 pixels', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test('the page outside the canvas has no horizontal scroll', async ({ page }) => {
    await openStarterView(page)
    await expectNoHorizontalScroll(page)
  })

  for (const name of [IMPORT_BUTTON_NAME, EXPORT_BUTTON_NAME]) {
    test(`${name} is fully inside the viewport`, async ({ page }) => {
      await openStarterView(page)
      await expect(namedButton(page, name)).toBeInViewport({ ratio: 1 })
    })
  }

  test('the help menu stacks above the canvas', async ({ page }) => {
    await openStarterView(page)
    const menu = await page.getByRole('navigation', { name: 'Help' }).boundingBox()
    const canvas = await page.getByRole('main').boundingBox()
    expect(menu.y + menu.height).toBeLessThanOrEqual(canvas.y)
  })

  test('the canvas is no wider than the viewport', async ({ page }) => {
    await openStarterView(page)
    const canvas = await page.getByRole('main').boundingBox()
    expect(canvas.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width)
  })

  test('a very long project name keeps Import and Export in view with no horizontal scroll', async ({
    page,
  }) => {
    await openStarterView(page)
    await importAndConfirm(
      page,
      fixturePath('long-name.json'),
      replaceQuestion('A'.repeat(LONG_PROJECT_NAME_LENGTH)),
    )
    await expect(namedButton(page, IMPORT_BUTTON_NAME)).toBeInViewport({ ratio: 1 })
    await expect(namedButton(page, EXPORT_BUTTON_NAME)).toBeInViewport({ ratio: 1 })
    await expectNoHorizontalScroll(page)
  })

  test('the import confirmation keeps both buttons in view with no horizontal scroll', async ({
    page,
  }) => {
    await openStarterView(page)
    await openConfirmation(page)
    for (const label of ['Replace map', 'Cancel']) {
      await expect(confirmDialog(page).getByRole('button', { name: label })).toBeInViewport({
        ratio: 1,
      })
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('the page keeps the menu beside the canvas at 640 pixels', () => {
  test.use({ viewport: { width: STACKING_BREAKPOINT_WIDTH, height: NARROW_VIEWPORT.height } })

  test('the help menu sits to the left of the canvas', async ({ page }) => {
    await openStarterView(page)
    const menu = await page.getByRole('navigation', { name: 'Help' }).boundingBox()
    const canvas = await page.getByRole('main').boundingBox()
    expect(menu.x + menu.width).toBeLessThanOrEqual(canvas.x)
  })
})
