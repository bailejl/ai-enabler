import { test, expect } from '@playwright/test'
import { scan } from './axe.js'
import { cardByTitle } from './canvas.js'

const STARTER_STEP_COUNT = 6
const EXPORT_BUTTON_NAME = 'Export project (JSON)'
const EXPORT_FILE_NAME = 'untitled-project.ai-enabler.json'
const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const RUNTIME_NODE_FIELDS = [
  'selected',
  'measured',
  'width',
  'height',
  'dragging',
  'positionAbsolute',
]
const EDGE_FIELDS = ['id', 'source', 'target']

const readDownloadedJson = async (download) => {
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

test('the header offers Export with a descriptive accessible name', async ({ page }) => {
  await page.goto('/')
  const exportButton = page.getByRole('banner').getByRole('button', { name: EXPORT_BUTTON_NAME })
  await expect(exportButton).toBeVisible()
  await expect(exportButton).toHaveText('Export')
})

test('the default view with the Export control passes the axe scan', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
})

test.describe('exporting the starter project after selecting Build', () => {
  const exportAfterSelectingBuild = async (page) => {
    await page.goto('/')
    await cardByTitle(page, 'Build').click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: EXPORT_BUTTON_NAME }).click()
    return downloadPromise
  }

  test('downloads untitled-project.ai-enabler.json at schema 0.0.0 with the project identity', async ({
    page,
  }) => {
    const download = await exportAfterSelectingBuild(page)
    expect(download.suggestedFilename()).toBe(EXPORT_FILE_NAME)
    const file = await readDownloadedJson(download)
    expect(file.schemaVersion).toBe('0.0.0')
    expect(file.exportedAt).toMatch(ISO_UTC_TIMESTAMP)
    expect(file.project.id).toBeTruthy()
    expect(file.project.name).toBe('Untitled Project')
  })

  test('carries no React Flow runtime fields on nodes and only id, source, target on edges', async ({
    page,
  }) => {
    const file = await readDownloadedJson(await exportAfterSelectingBuild(page))
    expect(file.nodes).toHaveLength(STARTER_STEP_COUNT)
    const nodeFields = new Set(file.nodes.flatMap((node) => Object.keys(node)))
    expect(RUNTIME_NODE_FIELDS.filter((field) => nodeFields.has(field))).toEqual([])
    expect(file.edges.length).toBeGreaterThan(0)
    expect(file.edges.map((edge) => Object.keys(edge).sort())).toEqual(
      file.edges.map(() => [...EDGE_FIELDS].sort()),
    )
  })

  test('announces the exported file name in the live region', async ({ page }) => {
    await exportAfterSelectingBuild(page)
    await expect(page.getByRole('status').filter({ hasText: 'Exported' })).toHaveText(
      `Exported ${EXPORT_FILE_NAME}`,
    )
  })
})
