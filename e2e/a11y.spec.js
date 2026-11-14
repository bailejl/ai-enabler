import { test, expect } from '@playwright/test'
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
