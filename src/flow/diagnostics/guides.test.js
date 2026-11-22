import { describe, expect, it } from 'vitest'
import catalog from './catalog.json' with { type: 'json' }
import {
  fileAccessProblems,
  missingGuides,
  noToolProblems,
  orphanGuides,
  shapeProblems,
} from './guideChecks.js'
import { readGuides } from './readGuides.js'
import { CATALOG_CODES } from './problem.js'

// The real guides, read the way the server reads them.
const GUIDES = readGuides(new URL('./guides/', import.meta.url))
const CODES = Object.keys(GUIDES)

// These codes have no tool repair, so their guides say so and tell the user what to do. The three
// APP_ codes join this list when their guides land.
const NO_TOOL_CODES = ['FILE_NOT_JSON', 'FILE_NOT_A_PROJECT', 'FILE_UNREADABLE', 'FILE_TOO_LARGE']

describe('the repair guides', () => {
  it('has a guide for every catalog code', () => {
    expect(missingGuides(CATALOG_CODES, GUIDES)).toEqual([])
  })

  it('has no guide for a code that is not in the catalog', () => {
    expect(orphanGuides(CATALOG_CODES, GUIDES)).toEqual([])
  })

  it.each(CODES)('%s has the catalog title and the three sections', (code) => {
    expect(shapeProblems(code, catalog[code]?.title, GUIDES[code])).toEqual([])
  })

  it.each(CODES)('%s never sends the agent to the project file', (code) => {
    expect(fileAccessProblems(GUIDES[code])).toEqual([])
  })

  it.each(NO_TOOL_CODES)('%s says no tool repairs it and tells the user what to do', (code) => {
    expect(noToolProblems(code, GUIDES[code])).toEqual([])
  })
})
