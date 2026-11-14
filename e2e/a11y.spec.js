import { test, expect } from '@playwright/test'
import { contrastRatio } from '../src/shell/contrast.js'
import { tokens } from '../src/shell/tokens.js'
import { scan } from './axe.js'
import { cardByTitle, edgeBetween } from './canvas.js'
import {
  asUpload,
  chooseFile,
  clickEdge,
  confirmDialog,
  deleteAllSteps,
  fixturePath,
  importAndConfirm,
  importStatus,
  metricRegion,
  openAllHelpSections,
  openStarterView,
} from './views.js'

const MULTI_SELECT_KEY = 'ControlOrMeta'
const MIN_FOCUS_OUTLINE_PX = 2
const MIN_NON_TEXT_CONTRAST = 3
const NARROW_VIEWPORT = { width: 320, height: 640 }

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

test('an import error has no axe violations', async ({ page }) => {
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
  await expect(page.getByRole('status').filter({ hasText: /\S/ })).toBeVisible()
  await expectNoViolations(page)
})

test('an imported map with On target and Needs attention tiles has no axe violations', async ({
  page,
}) => {
  await openStarterView(page)
  await importAndConfirm(page, fixturePath('on-target-and-needs-attention.json'))
  await expect(metricRegion(page).getByText('On target').first()).toBeVisible()
  await expect(metricRegion(page).getByText('Needs attention').first()).toBeVisible()
  await expectNoViolations(page)
})

test('a selected step and a selected connection have no axe violations', async ({ page }) => {
  await openStarterView(page)
  await cardByTitle(page, 'Plan').click()
  await clickEdge(page, 'build', 'test', MULTI_SELECT_KEY)
  await expect(cardByTitle(page, 'Plan')).toHaveClass(/selected/)
  await expect(edgeBetween(page, 'build', 'test')).toHaveClass(/selected/)
  await expectNoViolations(page)
})

const toRgbString = (hex) => {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return `rgb(${red}, ${green}, ${blue})`
}

// Each stop names the surface token behind its ring. Card, edge and control rings are drawn
// outside the element, on the canvas; the dialog buttons sit on the dialog's card surface.
const focusStops = [
  {
    name: 'the Import button',
    surface: 'headerBackground',
    find: (page) => page.getByRole('button', { name: 'Import project (JSON)' }),
  },
  {
    name: 'the Export button',
    surface: 'headerBackground',
    find: (page) => page.getByRole('button', { name: 'Export project (JSON)' }),
  },
  ...['How to use', 'Glossary', 'Help'].map((title) => ({
    name: `the ${title} help summary`,
    surface: 'menuBackground',
    find: (page) => page.locator('summary', { hasText: title }),
  })),
  {
    name: 'the Plan card',
    surface: 'pageBackground',
    find: (page) => cardByTitle(page, 'Plan'),
  },
  {
    name: 'the build to test connection',
    surface: 'pageBackground',
    find: (page) => edgeBetween(page, 'build', 'test'),
  },
  ...['Zoom In', 'Zoom Out', 'Fit View', 'Toggle Interactivity'].map((label) => ({
    name: `the ${label} control`,
    surface: 'cardBackground',
    find: (page) => page.getByRole('button', { name: label }),
  })),
  ...['Replace map', 'Cancel'].map((label) => ({
    name: `the ${label} dialog button`,
    surface: 'cardBackground',
    opensDialog: true,
    find: (page) => confirmDialog(page).getByRole('button', { name: label }),
  })),
]

// :focus-visible after a programmatic focus() needs a prior keyboard interaction, so Tab first.
const focusByKeyboard = async (locator) => {
  await locator.page().keyboard.press('Tab')
  await locator.focus()
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

test.describe('every control shows a visible focus indicator', () => {
  for (const { name, surface, opensDialog, find } of focusStops) {
    test(`${name} has a solid 2px+ ring with 3:1 contrast on ${surface}`, async ({ page }) => {
      await openStarterView(page)
      if (opensDialog) {
        await chooseFile(page, fixturePath('different-name.json'))
        await expect(confirmDialog(page)).toBeVisible()
      }
      await focusByKeyboard(find(page))

      const outline = await readOutline(find(page))

      expect(outline.isFocusVisible).toBe(true)
      expect(outline.style).toBe('solid')
      expect(outline.width).toBeGreaterThanOrEqual(MIN_FOCUS_OUTLINE_PX)
      expect(outline.color).toBe(toRgbString(tokens.focusRing))
      expect(contrastRatio(tokens.focusRing, tokens[surface])).toBeGreaterThanOrEqual(
        MIN_NON_TEXT_CONTRAST,
      )
    })
  }
})

test.describe('the page reflows at 320 pixels', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test('the page outside the canvas has no horizontal scroll', async ({ page }) => {
    await openStarterView(page)
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  for (const name of ['Import project (JSON)', 'Export project (JSON)']) {
    test(`${name} is fully inside the viewport`, async ({ page }) => {
      await openStarterView(page)
      const box = await page.getByRole('button', { name }).boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width)
    })
  }

  test('the help menu stacks above the canvas', async ({ page }) => {
    await openStarterView(page)
    const menu = await page.getByRole('navigation', { name: 'Help' }).boundingBox()
    const canvas = await page.getByRole('main').boundingBox()
    expect(menu.y + menu.height).toBeLessThanOrEqual(canvas.y)
    expect(canvas.width).toBeGreaterThanOrEqual(NARROW_VIEWPORT.width)
  })
})
