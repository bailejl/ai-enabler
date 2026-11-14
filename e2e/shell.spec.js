import { test, expect } from '@playwright/test'
import { scan } from './axe.js'

const STARTER_STEP_COUNT = 6
const PROJECT_NAME = 'Untitled Project'

test('the header shows the mark, the brand, a divider, and the project name', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header.locator('svg.header__mark')).toBeVisible()
  await expect(header.getByText('AI Enabler', { exact: true })).toBeVisible()
  await expect(header.getByRole('separator')).toBeVisible()
  const projectName = header.getByText(PROJECT_NAME, { exact: true })
  await expect(projectName).toBeVisible()
  await expect(projectName).toHaveAttribute('title', PROJECT_NAME)
})

test('the document title names the project and the app', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Untitled Project · AI Enabler')
})

test('the page has banner, Help navigation, and Value stream map landmarks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Help' })).toBeAttached()
  await expect(page.getByRole('main', { name: 'Value stream map' })).toBeVisible()
})

test('a long project name truncates without hiding the brand', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 })
  await page.goto('/')
  const projectName = page.locator('.header__project')
  await projectName.evaluate((element) => {
    element.textContent = 'W'.repeat(100)
  })
  const isTruncated = await projectName.evaluate((e) => e.scrollWidth > e.clientWidth)
  expect(isTruncated).toBe(true)
  await expect(page.getByText('AI Enabler', { exact: true })).toBeVisible()
})

test('reloading after deleting Idea restores six steps and stores nothing', async ({ page }) => {
  await page.goto('/')
  const steps = page.locator('.react-flow__node')
  await expect(steps).toHaveCount(STARTER_STEP_COUNT)
  await steps.filter({ hasText: 'Idea' }).click()
  await page.keyboard.press('Backspace')
  await expect(steps).toHaveCount(STARTER_STEP_COUNT - 1)

  await page.reload()

  await expect(steps).toHaveCount(STARTER_STEP_COUNT)
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0, databases: 0 })
})

test('the default view has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
})
