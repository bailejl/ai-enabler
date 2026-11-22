import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures.js'
import { contentHash } from '../src/flow/contentHash.js'
import { initialNodes } from '../src/flow/initialFlow.js'
import { problem } from '../src/flow/diagnostics/problem.js'
import { toMetricTiles } from '../src/flow/metrics.js'
import { CURRENT_SCHEMA_VERSION } from '../src/flow/schema/version.js'
import { scan } from './axe.js'
import { cardByTitle, cards, edgeBetween, selectEdge, settledBox } from './canvas.js'
import { ISO_UTC_TIMESTAMP } from './console.js'
import {
  asUpload,
  chooseFile,
  confirmDialog,
  fixturePath,
  importAndConfirm,
  importStatus,
  metricRegion,
  readFixture,
  STARTER_STEP_COUNT,
} from './views.js'

const EXPORT_BUTTON_NAME = 'Export project (JSON)'
const EXPORT_FILE_NAME = 'untitled-project.ai-enabler.json'
const EXPORT_NODE_FIELDS = ['data', 'id', 'position', 'type']
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
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  expect(await scan(page)).toEqual([])
})

test.describe('exporting the starter project after selecting Build', () => {
  const exportAfterSelectingBuild = async (page) => {
    await page.goto('/')
    await cardByTitle(page, 'Build').click()
    await expect(cardByTitle(page, 'Build')).toHaveClass(/selected/)
    const startedAt = Date.now()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: EXPORT_BUTTON_NAME }).click()
    const download = await downloadPromise
    return { download, startedAt, finishedAt: Date.now() }
  }

  test(`downloads untitled-project.ai-enabler.json at schema ${CURRENT_SCHEMA_VERSION} with the project identity`, async ({
    page,
  }) => {
    const { download, startedAt, finishedAt } = await exportAfterSelectingBuild(page)
    expect(download.suggestedFilename()).toBe(EXPORT_FILE_NAME)
    const file = await readDownloadedJson(download)
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(file.exportedAt).toMatch(ISO_UTC_TIMESTAMP)
    const exportedAtMs = Date.parse(file.exportedAt)
    expect(exportedAtMs).toBeGreaterThanOrEqual(startedAt)
    expect(exportedAtMs).toBeLessThanOrEqual(finishedAt)
    expect(typeof file.project.id).toBe('string')
    expect(file.project.id).not.toBe('')
    expect(file.project.name).toBe('Untitled Project')
  })

  test('carries no React Flow runtime fields on nodes and only id, source, target on edges', async ({
    page,
  }) => {
    const { download } = await exportAfterSelectingBuild(page)
    const file = await readDownloadedJson(download)
    expect(file.nodes).toHaveLength(STARTER_STEP_COUNT)
    expect(file.nodes.map((node) => Object.keys(node).sort())).toEqual(
      file.nodes.map(() => EXPORT_NODE_FIELDS),
    )
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

const EDITED_NOTICE = 'This file was changed outside AI Enabler after it was exported.'
const IMPORT_BUTTON_NAME = 'Import project (JSON)'
const STARTER_PROJECT_NAME = 'Untitled Project'
const SAME_NAME_QUESTION = `Replace current map with the imported version of ${STARTER_PROJECT_NAME}?`
const CHECKOUT_NAME = 'Checkout Revamp'
const CHECKOUT_QUESTION = `Replace current map with ${CHECKOUT_NAME}?`
const DIFFERENT_CASE_QUESTION = 'Replace current map with untitled project?'
const CANCELLED_ANNOUNCEMENT = 'Import cancelled'
// Expected wording comes from the diagnostics catalog, so a reworded message is one edit there.
const messageFor = (code, params) => problem(code, { params }).message
const NOT_JSON_MESSAGE = messageFor('FILE_NOT_JSON')
const NOT_A_PROJECT_MESSAGE = messageFor('FILE_NOT_A_PROJECT')
const LISTED_PROBLEM_LIMIT = 10
// Literal lead lines, so a change to the app's wording or counting fails here.
const LEAD_LINES = {
  1: 'Import rejected: 1 problem',
  2: 'Import rejected: 2 problems',
  10: 'Import rejected: 10 problems',
  14: 'Import rejected: 14 problems',
}
const leadLine = (count) => LEAD_LINES[count]
const rejectionAnnouncement = (messages) => `${leadLine(messages.length)}. ${messages[0]}`
const NOT_JSON_ANNOUNCEMENT = rejectionAnnouncement([NOT_JSON_MESSAGE])
// What the three Checkout Revamp steps in different-name.json add up to, in tile order.
const CHECKOUT_TILE_TEXTS = [
  '1d 5h',
  '3h 30m',
  '25.9% Watch',
  '72.0% On target',
  '2 On target',
  '1h 10m',
  '3',
]
const UNREADABLE_MESSAGE = messageFor('FILE_UNREADABLE')
const LONG_NAME_LENGTH = 100
const NARROW_VIEWPORT = { width: 1024, height: 768 }

// A file whose every step lacks a position and that has no connections: one problem per step.
const unplacedStepsFile = (count) => ({
  ...readFixture('same-name.json'),
  nodes: Array.from({ length: count }, (_, index) => ({
    id: `step-${index + 1}`,
    type: 'step',
    data: { label: `Idle ${index + 1}` },
  })),
  edges: [],
})
const unplacedMessages = (count) =>
  Array.from({ length: count }, (_, index) =>
    messageFor('STEP_POSITION_MISSING', { step: `Step "Idle ${index + 1}" (#${index + 1})` }),
  )

const fixtureSteps = (name) => readFixture(name).nodes.map((node) => node.data)

const importButton = (page) => page.getByRole('button', { name: IMPORT_BUTTON_NAME, exact: true })
const fileInput = (page) => page.locator('input[type="file"]')
const projectNameInHeader = (page) => page.locator('.header__project')

// The Announcer is the only polite live region that carries import and export messages.
const announcer = (page) => page.locator('[aria-live="polite"]')

// Records every non-empty text the live region takes, so a repeated message counts again.
const recordAnnouncements = async (page) => {
  await announcer(page).waitFor({ state: 'attached' })
  await page.evaluate(() => {
    const region = document.querySelector('[aria-live="polite"]')
    window.spokenMessages = []
    new MutationObserver(() => {
      if (region.textContent) window.spokenMessages.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })
}
const spokenMessages = (page) => page.evaluate(() => window.spokenMessages)

const exportProjectFile = async (page) => {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: EXPORT_BUTTON_NAME }).click()
  return readDownloadedJson(await downloadPromise)
}

const tileTexts = (page) => metricRegion(page).locator('dd').allTextContents()
const expectedTileTexts = (steps) =>
  toMetricTiles(steps).map(({ text, statusLabel }) =>
    statusLabel ? `${text} ${statusLabel}` : text,
  )

const expectInside = (inner, outer) => {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height)
}

const deleteEdge = async (page, from, to) => {
  await selectEdge(page, from, to)
  await page.keyboard.press('Backspace')
  await expect(edgeBetween(page, from, to)).toHaveCount(0)
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
  const starterBuild = initialNodes.find((node) => node.id === 'build')
  expect(first.nodes.find((node) => node.id === 'build').position).not.toEqual(
    starterBuild.position,
  )

  // Change the map after exporting, so the import has to restore what was exported.
  await cardByTitle(page, 'Production').click()
  await page.keyboard.press('Backspace')
  await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT - 1)
  expect(await tileTexts(page)).not.toEqual(tilesBefore)

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
    const starterTiles = await tileTexts(page)
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
    const importedTiles = await tileTexts(page)
    expect(importedTiles).toEqual(expectedTileTexts(fixtureSteps('different-name.json')))
    expect(importedTiles).toEqual(CHECKOUT_TILE_TEXTS)
    expect(importedTiles).not.toEqual(starterTiles)
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
    await expect(confirmDialog(page)).toHaveAccessibleName(DIFFERENT_CASE_QUESTION)
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
      const before = await exportProjectFile(page)
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
      expect(after.nodes).toEqual(before.nodes)
      expect(after.edges).toEqual(before.edges)
      expect(after.project.id).toBe(before.project.id)
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

  const withSecondEdge = (change) => {
    const file = validFile()
    file.edges[1] = change(file.edges[1])
    return file
  }

  const REJECTED_FILES = [
    {
      name: 'text that is not JSON',
      contents: 'this is not json',
      codes: ['FILE_NOT_JSON'],
      messages: [NOT_JSON_MESSAGE],
    },
    {
      name: 'an array',
      contents: [],
      codes: ['FILE_NOT_A_PROJECT'],
      messages: [NOT_A_PROJECT_MESSAGE],
    },
    {
      name: 'a file with no schemaVersion',
      contents: withoutSchemaVersion(),
      codes: ['FILE_NOT_A_PROJECT'],
      messages: [NOT_A_PROJECT_MESSAGE],
    },
    {
      name: 'schemaVersion "9.0.0" and a bad step',
      contents: {
        ...validFile(),
        schemaVersion: '9.0.0',
        nodes: [{ id: 'broken', data: {} }],
      },
      codes: ['FILE_NEWER_SCHEMA'],
      messages: [
        messageFor('FILE_NEWER_SCHEMA', { version: '9.0.0', current: CURRENT_SCHEMA_VERSION }),
      ],
    },
    {
      name: 'step #3 "Build" with no position',
      contents: withThirdStep((step) => ({
        ...omit(step, 'position'),
        data: { ...step.data, label: 'Build' },
      })),
      codes: ['STEP_POSITION_MISSING'],
      messages: [messageFor('STEP_POSITION_MISSING', { step: 'Step "Build" (#3)' })],
    },
    {
      name: 'connections that form a loop',
      contents: {
        ...validFile(),
        edges: [...validFile().edges, { id: 'ship->intake', source: 'ship', target: 'intake' }],
      },
      codes: ['CONN_LOOP'],
      messages: [messageFor('CONN_LOOP', { connection: 'Connection 3' })],
    },
    {
      name: 'connection #2 with no id',
      contents: withSecondEdge((edge) => omit(edge, 'id')),
      codes: ['CONN_ID_MISSING'],
      messages: [messageFor('CONN_ID_MISSING', { connection: 'Connection 2' })],
    },
    {
      name: 'connection #2 with the number 42 as its id',
      contents: withSecondEdge((edge) => ({ ...edge, id: 42 })),
      codes: ['CONN_ID_MISSING'],
      messages: [messageFor('CONN_ID_MISSING', { connection: 'Connection 2' })],
    },
    {
      name: 'connection #2 with an empty id',
      contents: withSecondEdge((edge) => ({ ...edge, id: '' })),
      codes: ['CONN_ID_MISSING'],
      messages: [messageFor('CONN_ID_MISSING', { connection: 'Connection 2' })],
    },
    {
      name: 'connection #2 with the id of connection #1',
      contents: withSecondEdge((edge) => ({ ...edge, id: validFile().edges[0].id })),
      codes: ['CONN_ID_DUPLICATE'],
      messages: [
        messageFor('CONN_ID_DUPLICATE', {
          connection: 'Connection 2',
          id: validFile().edges[0].id,
        }),
      ],
    },
    {
      name: 'two different problems: a step with no position and a connection with no id',
      contents: {
        ...withThirdStep((step) => omit(step, 'position')),
        edges: validFile().edges.map((edge, index) => (index === 1 ? omit(edge, 'id') : edge)),
      },
      codes: ['STEP_POSITION_MISSING', 'CONN_ID_MISSING'],
      messages: [
        messageFor('STEP_POSITION_MISSING', { step: 'Step "Ship" (#3)' }),
        messageFor('CONN_ID_MISSING', { connection: 'Connection 2' }),
      ],
    },
    // AC17: a mark saying AI tools made the file never skips validation.
    {
      name: 'an AI-marked file with two different problems',
      contents: {
        ...withThirdStep((step) => omit(step, 'position')),
        modifiedBy: { tool: 'aie-mcp', at: '2026-11-21T00:00:00.000Z' },
        edges: validFile().edges.map((edge, index) => (index === 1 ? omit(edge, 'id') : edge)),
      },
      codes: ['STEP_POSITION_MISSING', 'CONN_ID_MISSING'],
      messages: [
        messageFor('STEP_POSITION_MISSING', { step: 'Step "Ship" (#3)' }),
        messageFor('CONN_ID_MISSING', { connection: 'Connection 2' }),
      ],
    },
  ]

  for (const { name, contents, codes, messages } of REJECTED_FILES) {
    test(`${name}`, async ({ page, diagnostics }) => {
      diagnostics.expect(codes)
      await page.goto('/')
      const before = await exportProjectFile(page)
      await expect(announcer(page)).toHaveText(`Exported ${EXPORT_FILE_NAME}`)
      await recordAnnouncements(page)
      const tilesBefore = await tileTexts(page)

      await chooseFile(page, asUpload(contents))

      const status = importStatus(page)
      const heading = status.getByRole('heading', { name: leadLine(messages.length) })
      await expect(heading).toBeVisible()
      await expect(status.getByRole('listitem')).toHaveText(messages)
      await expect(status.getByRole('button', { name: 'Dismiss' })).toBeVisible()
      await expect(confirmDialog(page)).toHaveCount(0)
      await expect(heading).toBeFocused()
      await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
      await expect(projectNameInHeader(page)).toHaveText(STARTER_PROJECT_NAME)
      expect(await tileTexts(page)).toEqual(tilesBefore)
      const spoken = rejectionAnnouncement(messages)
      await expect(page.getByRole('status').filter({ hasText: spoken })).toHaveCount(1)
      // Read once, after everything has settled: a poll would miss a later duplicate.
      expect(await spokenMessages(page)).toEqual([spoken])
      const after = await exportProjectFile(page)
      expect(after.nodes).toEqual(before.nodes)
      expect(after.edges).toEqual(before.edges)
    })
  }

  test('a file with 14 problems lists 10 and counts the rest', async ({ page, diagnostics }) => {
    diagnostics.expect(['STEP_POSITION_MISSING'])
    await page.goto('/')
    const messages = unplacedMessages(14)

    await chooseFile(page, asUpload(unplacedStepsFile(14)))

    const status = importStatus(page)
    await expect(status.getByRole('heading', { name: leadLine(14) })).toBeFocused()
    await expect(status.getByRole('listitem')).toHaveCount(LISTED_PROBLEM_LIMIT)
    await expect(status.getByRole('listitem')).toHaveText(messages.slice(0, LISTED_PROBLEM_LIMIT))
    await expect(status).toContainText('and 4 more')
    await expect(status).not.toContainText(messages[LISTED_PROBLEM_LIMIT])
    await expect(announcer(page)).toHaveText(rejectionAnnouncement(messages))
  })

  test('exactly 10 problems list all 10 with no "more" line', async ({ page, diagnostics }) => {
    diagnostics.expect(['STEP_POSITION_MISSING'])
    await page.goto('/')

    await chooseFile(page, asUpload(unplacedStepsFile(10)))

    const status = importStatus(page)
    await expect(status.getByRole('heading', { name: leadLine(10) })).toBeVisible()
    await expect(status.getByRole('listitem')).toHaveCount(LISTED_PROBLEM_LIMIT)
    await expect(status).not.toContainText('more')
  })
})

test('the visible import status is not itself a live region', async ({ page, diagnostics }) => {
  diagnostics.expect(['FILE_NOT_JSON'])
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  const status = importStatus(page)
  await expect(status).toBeVisible()
  await expect(status.locator('[aria-live], [role="status"], [role="alert"]')).toHaveCount(0)
  await expect(status).not.toHaveAttribute('aria-live', /.*/)
})

test('when two files are chosen in a row, only the last one chosen asks for confirmation', async ({
  page,
}) => {
  // The first read is held until the test releases it, so that file finishes after the second.
  // It reads as `slowText`, and the real reader is back in place for every read after it.
  const slowFile = JSON.stringify(readFixture('different-name.json'))
  await page.addInitScript((slowText) => {
    const readText = Blob.prototype.text
    Blob.prototype.text = () => {
      Blob.prototype.text = readText
      return new Promise((resolve) => {
        window.releaseSlowRead = () => {
          window.slowReadSettled = true
          resolve(slowText)
        }
      })
    }
  }, slowFile)
  await page.goto('/')

  await chooseFile(page, asUpload(slowFile))
  await chooseFile(page, fixturePath('different-case-name.json'))
  await expect(confirmDialog(page)).toHaveAccessibleName(DIFFERENT_CASE_QUESTION)

  expect(await page.evaluate(() => window.slowReadSettled)).toBeFalsy()
  await page.evaluate(() => window.releaseSlowRead())
  await page.waitForFunction(() => window.slowReadSettled === true)
  // Two frames let React apply anything the slow read would have dispatched.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  await expect(confirmDialog(page)).toHaveAccessibleName(DIFFERENT_CASE_QUESTION)
  await expect(confirmDialog(page)).not.toContainText(CHECKOUT_NAME)
})

test('choosing the same invalid file again shows and announces the error again', async ({
  page,
  diagnostics,
}, testInfo) => {
  diagnostics.expect(['FILE_NOT_JSON'])
  const invalidFile = testInfo.outputPath('invalid.json')
  await writeFile(invalidFile, 'this is not json')
  await page.goto('/')
  await recordAnnouncements(page)

  await chooseFile(page, invalidFile)
  await expect.poll(() => spokenMessages(page)).toEqual([NOT_JSON_ANNOUNCEMENT])
  await expect(fileInput(page)).toHaveValue('')
  await chooseFile(page, invalidFile)

  await expect
    .poll(() => spokenMessages(page))
    .toEqual([NOT_JSON_ANNOUNCEMENT, NOT_JSON_ANNOUNCEMENT])
  await expect(importStatus(page)).toContainText(NOT_JSON_MESSAGE)
})

test('a file the browser cannot read shows the standard error and frees the input', async ({
  page,
  diagnostics,
}) => {
  diagnostics.expect(['FILE_UNREADABLE'])
  await page.addInitScript(() => {
    Blob.prototype.text = () => Promise.reject(new Error('unreadable'))
  })
  await page.goto('/')

  await chooseFile(page, asUpload('{}'))

  await expect(importStatus(page)).toContainText(UNREADABLE_MESSAGE)
  await expect(importStatus(page).getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await expect(announcer(page)).toHaveText(rejectionAnnouncement([UNREADABLE_MESSAGE]))
  await expect(fileInput(page)).toHaveValue('')
})

test('Dismiss removes the error and returns focus to Import', async ({ page, diagnostics }) => {
  diagnostics.expect(['FILE_NOT_JSON'])
  await page.goto('/')
  await chooseFile(page, asUpload('this is not json'))
  await expect(importStatus(page).getByRole('heading')).toBeFocused()

  await importStatus(page).getByRole('button', { name: 'Dismiss' }).click()

  await expect(importStatus(page)).toHaveCount(0)
  await expect(importButton(page)).toBeFocused()
})

test.describe('import states pass an accessibility scan', () => {
  test('with an import error showing', async ({ page, diagnostics }) => {
    diagnostics.expect(['FILE_NOT_JSON'])
    await page.goto('/')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await chooseFile(page, asUpload('this is not json'))
    await expect(importStatus(page)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('with a capped list of problems showing', async ({ page, diagnostics }) => {
    diagnostics.expect(['STEP_POSITION_MISSING'])
    await page.goto('/')
    await chooseFile(page, asUpload(unplacedStepsFile(14)))
    await expect(importStatus(page)).toContainText('and 4 more')
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

test('a successful import clears an earlier error', async ({ page, diagnostics }) => {
  diagnostics.expect(['FILE_NOT_JSON'])
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

  await expect(projectNameInHeader(page)).toHaveText(longName)
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
  const file = readFixture('badges-and-rounding.json')
  const queuedStep = {
    id: 'queued',
    type: 'step',
    position: { x: 400, y: 100 },
    data: { label: 'Queued', pt: 60, lt: 120, ca: 100, queue: 3 },
  }
  await importAndConfirm(
    page,
    asUpload({ ...file, nodes: [...file.nodes, queuedStep] }),
    'Replace current map with Badge Check?',
  )

  const card = cardByTitle(page, 'Only')
  await expect(card).toBeVisible()
  await expect(card.locator('.badge')).toHaveCount(0)
  // Guards the zero case: badges do render on a step whose counts are positive.
  await expect(cardByTitle(page, 'Queued').locator('.badge')).toContainText('Q 3')
  await expect(card).toContainText('88%')
})

test.describe('edit detection', () => {
  const withoutHash = ({ contentHash: _hash, ...file }) => file
  const exportedStarter = async (page) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    return exportProjectFile(page)
  }

  test('an exported file carries a contentHash that recomputes from the rest of the file', async ({
    page,
  }) => {
    const file = await exportedStarter(page)
    expect(file.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/)
    expect(await contentHash(withoutHash(file))).toBe(file.contentHash)
  })

  test('an untouched export imports with no mention of outside changes', async ({ page }) => {
    const file = await exportedStarter(page)
    await chooseFile(page, asUpload(file))
    await expect(confirmDialog(page)).toHaveAccessibleName(SAME_NAME_QUESTION)
    await expect(confirmDialog(page)).not.toContainText('changed outside')
    await confirmDialog(page).getByRole('button', { name: 'Replace map' }).click()
    await expect(importStatus(page)).toHaveText(`Imported ${STARTER_PROJECT_NAME}, 6 steps`)
    await expect(announcer(page)).toHaveText(`Imported ${STARTER_PROJECT_NAME}, 6 steps`)
  })

  const STARTER_FIRST_TITLE = initialNodes[0].data.label
  const EDITED_LABEL = 'Edited by hand'
  const EDITED_OPENING = `${SAME_NAME_QUESTION} ${EDITED_NOTICE}`

  const EDITED_FILES = [
    {
      change: 'a step label was edited',
      firstTitle: EDITED_LABEL,
      edit: (file) => ({
        ...file,
        nodes: file.nodes.map((node, index) =>
          index === 0 ? { ...node, data: { ...node.data, label: EDITED_LABEL } } : node,
        ),
      }),
    },
    { change: 'the contentHash was removed', firstTitle: STARTER_FIRST_TITLE, edit: withoutHash },
    {
      change: 'the contentHash is a number',
      firstTitle: STARTER_FIRST_TITLE,
      edit: (file) => ({ ...file, contentHash: 42 }),
    },
  ]

  for (const { change, firstTitle, edit } of EDITED_FILES) {
    test(`when ${change} the confirmation warns, Replace map still works, and the outcome repeats the warning`, async ({
      page,
    }) => {
      const file = await exportedStarter(page)
      await expect(announcer(page)).toHaveText(`Exported ${EXPORT_FILE_NAME}`)
      await recordAnnouncements(page)
      await chooseFile(page, asUpload(edit(file)))

      const dialog = confirmDialog(page)
      await expect(dialog).toContainText(EDITED_NOTICE)
      await expect(dialog).toHaveAccessibleDescription(new RegExp(EDITED_NOTICE))
      await expect(announcer(page)).toHaveText(EDITED_OPENING)
      expect(await spokenMessages(page)).toEqual([EDITED_OPENING])
      await dialog.getByRole('button', { name: 'Replace map' }).click()

      const outcome = `Imported ${STARTER_PROJECT_NAME}, 6 steps. ${EDITED_NOTICE}`
      await expect(importStatus(page)).toHaveText(outcome)
      await expect(announcer(page)).toHaveText(outcome)
      await expect(confirmDialog(page)).toHaveCount(0)
      await expect(cardByTitle(page, firstTitle)).toBeVisible()
    })
  }

  test('cancelling an edited file changes nothing and does not repeat the warning', async ({
    page,
  }) => {
    const file = await exportedStarter(page)
    await chooseFile(page, asUpload(withoutHash(file)))
    await expect(confirmDialog(page)).toContainText(EDITED_NOTICE)
    await expect(announcer(page)).toContainText(EDITED_NOTICE)
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(announcer(page)).toHaveText(CANCELLED_ANNOUNCEMENT)
    await expect(page.getByText(EDITED_NOTICE)).toHaveCount(0)
  })

  test('the confirmation with the warning passes the accessibility scan', async ({ page }) => {
    const file = await exportedStarter(page)
    await chooseFile(page, asUpload(withoutHash(file)))
    await expect(confirmDialog(page)).toContainText(EDITED_NOTICE)
    expect(await scan(page)).toEqual([])
  })
})

test.describe('a file changed by an AI tool', () => {
  const MARKED_FIXTURE = path.join(
    import.meta.dirname,
    '../src/flow/schema/fixtures/0.1.0-marked.json',
  )
  const readMarked = () => JSON.parse(readFileSync(MARKED_FIXTURE, 'utf8'))
  const MARKED_NAME = 'Fixture 0.1.0 marked'
  const MARKED_QUESTION = `Replace current map with ${MARKED_NAME}?`
  const MARKED_STEP_COUNT = 5
  const AI_NOTICE =
    'This file was changed by AI tools (aie-mcp) on 2026-11-20. Review the steps and numbers before relying on them.'
  const withHash = async (file) => ({ ...file, contentHash: await contentHash(file) })

  test('shows the AI notice in the confirmation and the outcome, and not the edited notice', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
    await recordAnnouncements(page)
    await chooseFile(page, MARKED_FIXTURE)

    const dialog = confirmDialog(page)
    const opening = `${MARKED_QUESTION} ${AI_NOTICE}`
    await expect(dialog).toContainText(AI_NOTICE)
    await expect(dialog).toHaveAccessibleDescription(
      `Current project: Untitled Project. Incoming project: ${MARKED_NAME}. ${AI_NOTICE}`,
    )
    await expect(dialog).not.toContainText('changed outside')
    await expect(announcer(page)).toHaveText(opening)
    expect(await spokenMessages(page)).toEqual([opening])
    await dialog.getByRole('button', { name: 'Replace map' }).click()

    const outcome = `Imported ${MARKED_NAME}, ${MARKED_STEP_COUNT} steps. ${AI_NOTICE}`
    await expect(importStatus(page)).toHaveText(outcome)
    await expect(announcer(page)).toHaveText(outcome)
    await expect(confirmDialog(page)).toHaveCount(0)
  })

  test('the confirmation with the AI notice passes the accessibility scan', async ({ page }) => {
    await page.goto('/')
    await chooseFile(page, MARKED_FIXTURE)
    await expect(confirmDialog(page)).toContainText(AI_NOTICE)
    expect(await scan(page)).toEqual([])
  })

  test('exporting after moving a step writes the current schema, no mark and the new position', async ({
    page,
  }) => {
    await page.goto('/')
    await importAndConfirm(page, MARKED_FIXTURE, MARKED_QUESTION)
    await expect(cards(page)).toHaveCount(MARKED_STEP_COUNT)
    await dragCardBy(page, 'Build', { dx: 40, dy: 120 })

    const exported = await exportProjectFile(page)
    const fixtureBuild = readMarked().nodes.find((node) => node.id === 'build')
    expect(exported.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(exported).not.toHaveProperty('modifiedBy')
    expect(exported.nodes.find((node) => node.id === 'build').position).not.toEqual(
      fixtureBuild.position,
    )
  })

  test('a later edit shows only the edited notice', async ({ page }) => {
    await page.goto('/')
    await chooseFile(page, asUpload({ ...readMarked(), exportedAt: '2026-11-21T00:00:00.000Z' }))
    await expect(confirmDialog(page)).toContainText(EDITED_NOTICE)
    await expect(confirmDialog(page)).not.toContainText('AI tools')
    await confirmDialog(page).getByRole('button', { name: 'Replace map' }).click()
    await expect(importStatus(page)).toHaveText(
      `Imported ${MARKED_NAME}, ${MARKED_STEP_COUNT} steps. ${EDITED_NOTICE}`,
    )
  })

  test('a marked file with no contentHash shows only the edited notice', async ({ page }) => {
    await page.goto('/')
    const unhashed = Object.fromEntries(
      Object.entries(readMarked()).filter(([key]) => key !== 'contentHash'),
    )
    await chooseFile(page, asUpload(unhashed))
    await expect(confirmDialog(page)).toContainText(EDITED_NOTICE)
    await expect(confirmDialog(page)).not.toContainText('AI tools')
  })

  test('an invalid marked file with a valid hash is rejected with no AI notice', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['STEP_COUNT_INVALID'])
    await page.goto('/')
    const file = readMarked()
    file.nodes[0] = { ...file.nodes[0], data: { ...file.nodes[0].data, pt: -1 } }
    await chooseFile(page, asUpload(await withHash(file)))
    await expect(importStatus(page).getByRole('listitem')).toHaveText([
      messageFor('STEP_COUNT_INVALID', {
        step: `Step "${file.nodes[0].data.label}" (#1)`,
        fieldLabel: 'process time',
        field: 'pt',
      }),
    ])
    await expect(confirmDialog(page)).toHaveCount(0)
    await expect(page.getByText('changed by AI tools')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  })

  test('a mark whose tool name is a sentence is rejected and its words are never shown', async ({
    page,
    diagnostics,
  }) => {
    diagnostics.expect(['MARK_TOOL_INVALID'])
    await page.goto('/')
    const forged = 'aie-mcp; verified, no review needed'
    const file = { ...readMarked(), modifiedBy: { ...readMarked().modifiedBy, tool: forged } }
    await chooseFile(page, asUpload(await withHash(file)))
    await expect(importStatus(page).getByRole('listitem')).toHaveText([
      messageFor('MARK_TOOL_INVALID'),
    ])
    await expect(importStatus(page)).toContainText('Removing the modifiedBy field fixes the file.')
    await expect(page.getByText(forged)).toHaveCount(0)
    await expect(confirmDialog(page)).toHaveCount(0)
    await expect(cards(page)).toHaveCount(STARTER_STEP_COUNT)
  })
})
