import { test, expect } from '@playwright/test'

// Placeholder: enable once the app serves on baseURL (see playwright.config.js).
test.fixme('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
})
