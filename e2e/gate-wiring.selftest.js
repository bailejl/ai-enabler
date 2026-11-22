// Self-test for the e2e gate, run by e2e/gate.spec.js through playwright.selftest.config.js. These
// tests fail on purpose, so the main config does not match this file and `npm run test:e2e` never
// runs it directly.
import { test } from './fixtures.js'
import { asUpload, chooseFile } from './views.js'

const NOT_JSON = 'this is not json'

test.describe('the test fixture fails a test', () => {
  test('that wrote an undeclared record', async ({ page }) => {
    await page.goto('/')

    await chooseFile(page, asUpload(NOT_JSON))
  })

  test('that wrote an uncoded console error', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => window.console.error('not a record'))
  })
})
