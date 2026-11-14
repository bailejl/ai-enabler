import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { metricTiles } from '../src/flow/metrics.js'
import { scan } from './axe.js'
import { cardByTitle, edgeBetween, settledBox } from './canvas.js'

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

const IMPORT_BUTTON_NAME = 'Import project (JSON)'
const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures')
const STARTER_PROJECT_NAME = 'Untitled Project'
const SAME_NAME_QUESTION = `Replace current map with the imported version of ${STARTER_PROJECT_NAME}?`
const CHECKOUT_NAME = 'Checkout Revamp'
const CHECKOUT_QUESTION = `Replace current map with ${CHECKOUT_NAME}?`
const CANCELLED_ANNOUNCEMENT = 'Import cancelled'
const NOT_JSON_MESSAGE = 'This file is not valid JSON.'
const NOT_A_PROJECT_MESSAGE = 'This is not a project file. Choose a file exported from AI Enabler.'
const LONG_NAME_LENGTH = 100
const NARROW_VIEWPORT = { width: 1024, height: 768 }

const fixturePath = (name) => path.join(FIXTURES_DIR, name)
const readFixture = (name) => JSON.parse(readFileSync(fixturePath(name), 'utf8'))
const fixtureSteps = (name) => readFixture(name).nodes.map((node) => node.data)

const importButton = (page) => page.getByRole('button', { name: IMPORT_BUTTON_NAME, exact: true })
const fileInput = (page) => page.locator('input[type="file"]')
const confirmDialog = (page) => page.getByRole('dialog')
const importStatus = (page) => page.getByRole('region', { name: 'Import status' })
const projectNameInHeader = (page) => page.locator('.header__project')
const cards = (page) => page.locator('.react-flow__node')
const metricRegion = (page) => page.getByRole('region', { name: 'Metrics' })

// The Announcer is the only polite live region that carries import and export messages.
const announcer = (page) => page.locator('[aria-live="polite"]')

const asUpload = (value) => ({
  name: 'chosen.json',
  mimeType: 'application/json',
  buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
})

const chooseFile = (page, file) => fileInput(page).setInputFiles(file)

// Records every non-empty text the live region takes, so a repeated message counts again.
const recordAnnouncements = (page) =>
  page.evaluate(() => {
    const region = document.querySelector('[aria-live="polite"]')
    window.spokenMessages = []
    new MutationObserver(() => {
      if (region.textContent) window.spokenMessages.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })
const spokenMessages = (page) => page.evaluate(() => window.spokenMessages)

const exportProjectFile = async (page) => {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: EXPORT_BUTTON_NAME }).click()
  return readDownloadedJson(await downloadPromise)
}

const tileTexts = (page) => metricRegion(page).locator('dd').allTextContents()
const expectedTileTexts = (steps) =>
  metricTiles(steps).map(({ text, statusLabel }) => (statusLabel ? `${text} ${statusLabel}` : text))

const importAndConfirm = async (page, file, question) => {
  await chooseFile(page, file)
  await expect(confirmDialog(page)).toHaveAccessibleName(question)
  await confirmDialog(page).getByRole('button', { name: 'Replace map' }).click()
  await expect(confirmDialog(page)).toHaveCount(0)
}

const expectInside = (inner, outer) => {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height)
}

const deleteEdge = async (page, from, to) => {
  const edge = edgeBetween(page, from, to)
  const box = await edge.locator('.react-flow__edge-interaction').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(edge).toHaveClass(/selected/)
  await page.keyboard.press('Backspace')
  await expect(edge).toHaveCount(0)
}

const dragCardBy = async (page, title, { dx, dy }) => {
  const box = await settledBox(cardByTitle(page, title))
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 })
  await page.mouse.up()
}

test('the Import control has a descriptive accessible name and a visible short label', async ({
  page,
}) => {
  await page.goto('/')
  const button = page.getByRole('banner').getByRole('button', { name: IMPORT_BUTTON_NAME })
  await expect(button).toBeVisible()
  await expect(button).toHaveText('Import')
  await expect(button).toHaveAccessibleName(IMPORT_BUTTON_NAME)
  await expect(fileInput(page)).toHaveAttribute('accept', '.json,application/json')
})

test('exporting then importing that file and confirming leaves the nodes, edges and tiles unchanged', async ({
  page,
}) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  await deleteEdge(page, 'plan', 'build')
  await dragCardBy(page, 'Build', { dx: 40, dy: 120 })
  const tilesBefore = await tileTexts(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: EXPORT_BUTTON_NAME }).click()
  const download = await downloadPromise
  const first = await readDownloadedJson(download)

  await importAndConfirm(page, await download.path(), SAME_NAME_QUESTION)
  await expect(importStatus(page)).toHaveText(`Imported ${STARTER_PROJECT_NAME}, 6 steps`)
  const second = await exportProjectFile(page)

  expect(second.nodes).toEqual(first.nodes)
  expect(second.edges).toEqual(first.edges)
  expect(await tileTexts(page)).toEqual(tilesBefore)
})

test.describe('importing a file with three steps', () => {
  test('a same-name file asks first, with focus on Cancel and both project names in the body', async ({
    page,
  }) => {
    await page.goto('/')
    await chooseFile(page, fixturePath('same-name.json'))
    const dialog = confirmDialog(page)
    await expect(dialog).toHaveAccessibleName(SAME_NAME_QUESTION)
    await expect(dialog.getByRole('heading', { name: SAME_NAME_QUESTION })).toBeVisible()
    await expect(dialog).toContainText(`Current project: ${STARTER_PROJECT_NAME}`)
    await expect(dialog).toContainText(`Incoming project: ${STARTER_PROJECT_NAME}`)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  })

  test('replacing shows the three cards in the canvas, keeps the project id, then announces and shows the outcome', async ({
    page,
  }) => {
    await page.goto('/')
    await recordAnnouncements(page)
    const before = await exportProjectFile(page)
    await importAndConfirm(page, fixturePath('same-name.json'), SAME_NAME_QUESTION)

    await expect(cards(page)).toHaveCount(3)
    const canvas = await settledBox(page.getByRole('main'))
    for (const card of await cards(page).all()) {
      expectInside(await settledBox(card), canvas)
    }
    const outcome = `Imported ${STARTER_PROJECT_NAME}, 3 steps`
    await expect(importStatus(page)).toHaveText(outcome)
    await expect(announcer(page)).toHaveText(outcome)
    await expect(importButton(page)).toBeFocused()
    expect((await exportProjectFile(page)).project.id).toBe(before.project.id)
  })

  test('a different-name file asks, then takes the name and id and recomputes every tile', async ({
    page,
  }) => {
    await page.goto('/')
    await chooseFile(page, fixturePath('different-name.json'))
    const dialog = confirmDialog(page)
    await expect(dialog).toHaveAccessibleName(CHECKOUT_QUESTION)
    await expect(dialog).toContainText(`Current project: ${STARTER_PROJECT_NAME}`)
    await expect(dialog).toContainText(`Incoming project: ${CHECKOUT_NAME}`)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()

    await dialog.getByRole('button', { name: 'Replace map' }).click()
    await expect(projectNameInHeader(page)).toHaveText(CHECKOUT_NAME)
    await expect(page).toHaveTitle(`${CHECKOUT_NAME} · AI Enabler`)
    await expect(importButton(page)).toBeFocused()
    expect(await tileTexts(page)).toEqual(expectedTileTexts(fixtureSteps('different-name.json')))
    expect((await exportProjectFile(page)).project.id).toBe('abc')
  })

  test('a file whose id matches the open project still asks the different-name question', async ({
    page,
  }) => {
    await page.goto('/')
    const { project } = await exportProjectFile(page)
    const file = {
      ...readFixture('different-name.json'),
      project: { ...project, name: CHECKOUT_NAME },
    }
    await chooseFile(page, asUpload(file))
    await expect(confirmDialog(page)).toHaveAccessibleName(CHECKOUT_QUESTION)
  })

  test('name matching is exact: a case-different name asks the different-name question', async ({
    page,
  }) => {
    await page.goto('/')
    await chooseFile(page, fixturePath('different-case-name.json'))
    await expect(confirmDialog(page)).toHaveAccessibleName(
      'Replace current map with untitled project?',
    )
  })
})

test.describe('cancelling the confirmation changes nothing', () => {
  const CANCEL_PATHS = [
    {
      kind: 'different-name',
      action: 'chooses Cancel',
      fixture: 'different-name.json',
      cancel: (page) => confirmDialog(page).getByRole('button', { name: 'Cancel' }).click(),
    },
    {
      kind: 'different-name',
      action: 'presses Escape',
      fixture: 'different-name.json',
      cancel: (page) => page.keyboard.press('Escape'),
    },
    {
      kind: 'same-name',
      action: 'clicks the backdrop',
      fixture: 'same-name.json',
      // The dialog is centred, so the viewport's corner is backdrop.
      cancel: (page) => page.mouse.click(5, 5),
    },
  ]

  for (const { kind, action, fixture, cancel } of CANCEL_PATHS) {
    test(`a ${kind} file, when the user ${action}`, async ({ page }) => {
      await page.goto('/')
      await recordAnnouncements(page)
      const nodesBefore = (await exportProjectFile(page)).nodes
      const tilesBefore = await tileTexts(page)
      await chooseFile(page, fixturePath(fixture))
      await expect(confirmDialog(page)).toBeVisible()

      await cancel(page)

      await expect(confirmDialog(page)).toHaveCount(0)
      await expect(announcer(page)).toHaveText(CANCELLED_ANNOUNCEMENT)
      await expect(importButton(page)).toBeFocused()
      await expect(projectNameInHeader(page)).toHaveText(STARTER_PROJECT_NAME)
      await expect(page).toHaveTitle(`${STARTER_PROJECT_NAME} · AI Enabler`)
      expect(await tileTexts(page)).toEqual(tilesBefore)
      const after = await exportProjectFile(page)
      expect(after.nodes).toEqual(nodesBefore)
      expect(after.project.name).toBe(STARTER_PROJECT_NAME)
    })
  }

  test('the project id is unchanged after a cancelled different-name import', async ({ page }) => {
    await page.goto('/')
    const before = await exportProjectFile(page)
    await chooseFile(page, fixturePath('different-name.json'))
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(confirmDialog(page)).toHaveCount(0)
    expect((await exportProjectFile(page)).project.id).toBe(before.project.id)
  })
})

test.describe('invalid files are rejected with a plain message', () => {
  const validFile = () => readFixture('same-name.json')
  const withThirdStep = (change) => {
    const file = validFile()
    file.nodes[2] = change(file.nodes[2])
    return file
  }
  const omit = (object, key) =>
    Object.fromEntries(Object.entries(object).filter(([k]) => k !== key))
  const withoutSchemaVersion = () => omit(validFile(), 'schemaVersion')

  const REJECTED_FILES = [
    { name: 'text that is not JSON', contents: 'this is not json', message: NOT_JSON_MESSAGE },
    { name: 'an array', contents: [], message: NOT_A_PROJECT_MESSAGE },
    {
      name: 'a file with no schemaVersion',
      contents: withoutSchemaVersion(),
      message: NOT_A_PROJECT_MESSAGE,
    },
    {
      name: 'schemaVersion "9.0.0" and a bad step',
      contents: {
        ...validFile(),
        schemaVersion: '9.0.0',
        nodes: [{ id: 'broken', data: {} }],
      },
      message:
        'This file uses schema 9.0.0; this app supports up to 0.0.0. Update the app or re-export the file.',
    },
    {
      name: 'step #3 "Build" with no position',
      contents: withThirdStep((step) => ({
        ...omit(step, 'position'),
        data: { ...step.data, label: 'Build' },
      })),
      message: 'Step "Build" (#3) is missing a position.',
    },
    {
      name: 'connections that form a loop',
      contents: {
        ...validFile(),
        edges: [...validFile().edges, { id: 'ship->intake', source: 'ship', target: 'intake' }],
      },
      message: 'The connections form a loop.',
    },
  ]

  for (const { name, contents, message } of REJECTED_FILES) {
    test(`${name}`, async ({ page }) => {
      await page.goto('/')
      await recordAnnouncements(page)
      const tilesBefore = await tileTexts(page)

      await chooseFile(page, asUpload(contents))

      const status = importStatus(page)
      await expect(status).toContainText(message)
      await expect(status.getByRole('button', { name: 'Dismiss' })).toBeVisible()
      await expect(confirmDialog(page)).toHaveCount(0)
      await expect(importButton(page)).toBeFocused()
      await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
      await expect(projectNameInHeader(page)).toHaveText(STARTER_PROJECT_NAME)
      expect(await tileTexts(page)).toEqual(tilesBefore)
      await expect.poll(() => spokenMessages(page)).toEqual([message])
      await expect(page.getByRole('status').filter({ hasText: message })).toHaveCount(1)
    })
  }
})

test('the visible import status is not itself a live region', async ({ page }) => {
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  const status = importStatus(page)
  await expect(status).toBeVisible()
  await expect(status.locator('[aria-live], [role="status"], [role="alert"]')).toHaveCount(0)
})

test('choosing the same invalid file again shows and announces the error again', async ({
  page,
}, testInfo) => {
  const invalidFile = testInfo.outputPath('invalid.json')
  await writeFile(invalidFile, 'this is not json')
  await page.goto('/')
  await recordAnnouncements(page)

  await chooseFile(page, invalidFile)
  await expect.poll(() => spokenMessages(page)).toEqual([NOT_JSON_MESSAGE])
  await chooseFile(page, invalidFile)

  await expect.poll(() => spokenMessages(page)).toEqual([NOT_JSON_MESSAGE, NOT_JSON_MESSAGE])
  await expect(importStatus(page)).toContainText(NOT_JSON_MESSAGE)
})

test('Dismiss removes the error and returns focus to Import', async ({ page }) => {
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  await expect(importStatus(page)).toBeVisible()

  await importStatus(page).getByRole('button', { name: 'Dismiss' }).click()

  await expect(importStatus(page)).toHaveCount(0)
  await expect(importButton(page)).toBeFocused()
})

test.describe('import states pass an accessibility scan', () => {
  test('with an import error showing', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await chooseFile(page, asUpload('this is not json'))
    await expect(importStatus(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('with the confirmation open', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await chooseFile(page, fixturePath('different-name.json'))
    await expect(confirmDialog(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('with the success line showing after a replace', async ({ page }) => {
    await page.goto('/')
    await importAndConfirm(page, fixturePath('different-name.json'), CHECKOUT_QUESTION)
    await expect(importStatus(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})

test('a successful import clears an earlier error', async ({ page }) => {
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  await expect(importStatus(page)).toContainText(NOT_JSON_MESSAGE)

  await importAndConfirm(page, fixturePath('different-name.json'), CHECKOUT_QUESTION)

  await expect(page.getByText(NOT_JSON_MESSAGE)).toHaveCount(0)
  await expect(importStatus(page).getByRole('button', { name: 'Dismiss' })).toHaveCount(0)
})

test('a 100-character project name is truncated and keeps Import and Export in view at 1024px', async ({
  page,
}) => {
  await page.setViewportSize(NARROW_VIEWPORT)
  await page.goto('/')
  const longName = readFixture('long-name.json').project.name
  expect(longName).toHaveLength(LONG_NAME_LENGTH)
  await importAndConfirm(
    page,
    fixturePath('long-name.json'),
    `Replace current map with ${longName}?`,
  )

  const brandLineCount = await page.locator('.header__brand').evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  })
  expect(brandLineCount).toBe(1)
  await expect(page.locator('.header__brand')).toHaveText('AI Enabler')
  await expect(importButton(page)).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: EXPORT_BUTTON_NAME })).toBeInViewport({ ratio: 1 })
  const name = projectNameInHeader(page)
  await expect(name).toHaveCSS('text-overflow', 'ellipsis')
  expect(await name.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await expect(name).toHaveAttribute('title', longName)
  await expect(name).toHaveAccessibleName(longName)
  await expect(name).toHaveText(longName)
})

test('an imported step with queue 0, batch 0 and %C&A 87.6 shows no badges and rounds to 88%', async ({
  page,
}) => {
  await page.goto('/')
  await importAndConfirm(
    page,
    fixturePath('badges-and-rounding.json'),
    'Replace current map with Badge Check?',
  )

  const card = cardByTitle(page, 'Only')
  await expect(card).toBeVisible()
  await expect(card.locator('.badge')).toHaveCount(0)
  await expect(card).toContainText('88%')
})
