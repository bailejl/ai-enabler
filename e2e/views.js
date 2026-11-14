import path from 'node:path'
import { expect } from '@playwright/test'
import { edgeBetween } from './canvas.js'

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures')
const HELP_SECTION_COUNT = 3

export const STARTER_STEP_COUNT = 6

export const fixturePath = (name) => path.join(FIXTURES_DIR, name)

export const cards = (page) => page.locator('.react-flow__node')
export const metricRegion = (page) => page.getByRole('region', { name: 'Metrics' })
export const importStatus = (page) => page.getByRole('region', { name: 'Import status' })
export const confirmDialog = (page) => page.getByRole('dialog')

export const openStarterView = async (page) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
}

export const openAllHelpSections = async (page) => {
  const nav = page.getByRole('navigation', { name: 'Help' })
  const sections = nav.locator('details')
  await expect(sections).toHaveCount(HELP_SECTION_COUNT)
  for (const section of await sections.all()) {
    await section.locator('summary').click()
  }
  await expect(nav.locator('details[open]')).toHaveCount(HELP_SECTION_COUNT)
}

export const chooseFile = (page, file) => page.locator('input[type="file"]').setInputFiles(file)

export const asUpload = (text) => ({
  name: 'chosen.json',
  mimeType: 'application/json',
  buffer: Buffer.from(text),
})

export const importAndConfirm = async (page, file) => {
  await chooseFile(page, file)
  await confirmDialog(page).getByRole('button', { name: 'Replace map' }).click()
  await expect(confirmDialog(page)).toHaveCount(0)
}

export const deleteAllSteps = async (page) => {
  for (let remaining = await cards(page).count(); remaining > 0; remaining -= 1) {
    await cards(page).first().click()
    await page.keyboard.press('Backspace')
    await expect(cards(page)).toHaveCount(remaining - 1)
  }
}

// Clicks the connection's midpoint; hold `modifier` to add it to the selection.
export const clickEdge = async (page, from, to, modifier) => {
  const box = await edgeBetween(page, from, to)
    .locator('.react-flow__edge-interaction')
    .boundingBox()
  if (modifier) await page.keyboard.down(modifier)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  if (modifier) await page.keyboard.up(modifier)
}
