import { describe, expect, it } from 'vitest'
import catalog from './catalog.json' with { type: 'json' }
import { fileAccessProblems, shapeProblems } from './guideChecks.js'
import { readGuides } from './readGuides.js'

// The real guides, read the way the server reads them.
const GUIDES = readGuides(new URL('./guides/', import.meta.url))
const CODES = Object.keys(GUIDES)

describe('the repair guides', () => {
  it('has guides to check', () => {
    expect(CODES.length).toBeGreaterThan(0)
  })

  it.each(CODES)('%s has the catalog title and the three sections', (code) => {
    expect(shapeProblems(code, catalog[code]?.title, GUIDES[code])).toEqual([])
  })

  it.each(CODES)('%s never sends the agent to the project file', (code) => {
    expect(fileAccessProblems(GUIDES[code])).toEqual([])
  })
})
