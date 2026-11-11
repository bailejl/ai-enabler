import { test, expect } from '@playwright/test'

test('value stream canvas shows the starter stages', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('ai-enabler')
  await expect(page.locator('.react-flow__node')).toHaveCount(6)
  await expect(page.getByText('Idea', { exact: true })).toBeVisible()
  await expect(page.getByText('Production', { exact: true })).toBeVisible()
})
