import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { STEP_TYPE } from '../src/flow/step.js'
import { cards } from './canvas.js'

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures')
const HELP_SECTION_COUNT = 3

export const STARTER_STEP_COUNT = 6
export const EMPTY_MAP_MESSAGE =
  'No steps on this map. Import a project, or reload to restore the starter map.'

export const fixturePath = (name) => path.join(FIXTURES_DIR, name)
export const readFixture = (name) => JSON.parse(readFileSync(fixturePath(name), 'utf8'))

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

// A file chosen from memory: JSON text as given, or any other value written as JSON.
export const asUpload = (value) => ({
  name: 'chosen.json',
  mimeType: 'application/json',
  buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
})

export const replaceQuestion = (incomingName) => `Replace current map with ${incomingName}?`

// Chooses the file, checks the dialog asks `question`, confirms, and waits for the dialog to go.
export const importAndConfirm = async (page, file, question) => {
  await chooseFile(page, file)
  await expect(confirmDialog(page)).toHaveAccessibleName(question)
  await confirmDialog(page).getByRole('button', { name: 'Replace map' }).click()
  await expect(confirmDialog(page)).toHaveCount(0)
}

// A step with both a queue and a batch badge joins the fixture's Watch-rated, rounded step.
const BADGED_STEP = {
  id: 'badged',
  type: STEP_TYPE,
  position: { x: 400, y: 100 },
  data: { label: 'Badged', pt: 60, lt: 120, ca: 100, queue: 3, batch: 4 },
}

export const openBadgesView = async (page) => {
  await openStarterView(page)
  const fixture = readFixture('badges-and-rounding.json')
  const nodes = [...fixture.nodes, BADGED_STEP]
  await importAndConfirm(page, asUpload({ ...fixture, nodes }), replaceQuestion('Badge Check'))
}

export const deleteAllSteps = async (page) => {
  for (let remaining = await cards(page).count(); remaining > 0; remaining -= 1) {
    await cards(page).first().click()
    await page.keyboard.press('Backspace')
    await expect(cards(page)).toHaveCount(remaining - 1)
  }
}
