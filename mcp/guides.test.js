import { describe, expect, it } from 'vitest'
import schema from '../public/schema/project-0.1.0.json' with { type: 'json' }
import {
  DESTRUCTIVE_TOOLS,
  unaskedDestructiveProblems,
  unknownNameProblems,
} from '../src/flow/diagnostics/guideChecks.js'
import { CATALOG_CODES, DETAIL_KEYS } from '../src/flow/diagnostics/problem.js'
import { GATES } from '../src/flow/gates/index.js'
import { GUIDES } from './guideSource.js'
import { TOOLS } from './tools.js'

// The real guides, from the module the server uses. This test lives in mcp/ because it needs the
// real tool list and src/ does not import from mcp/.
const GUIDE_CODES = Object.keys(GUIDES)

const TOOL_NAMES = TOOLS.map(({ name }) => name)

// The names a guide may put in backticks: the real tools, every field name a call, a problem or a
// project file has, the gate ids and the catalog codes. Imported, not copied.
const NAMES = {
  tools: TOOL_NAMES,
  properties: [
    ...TOOLS.flatMap(({ inputSchema }) => Object.keys(inputSchema.properties)),
    ...DETAIL_KEYS,
    ...Object.keys(schema.properties),
  ],
  gates: Object.keys(GATES),
  codes: CATALOG_CODES,
}

describe('the repair guides name only real things', () => {
  it('has the name lists it checks against', () => {
    expect(NAMES.tools).toContain('get_project')
    expect(NAMES.properties).toEqual(
      expect.arrayContaining(['stepId', 'sourceId', 'edgeId', 'schemaVersion', 'modifiedBy']),
    )
    expect(NAMES.gates).toContain('data-complete')
    expect(NAMES.codes).toContain('CONN_LOOP')
  })

  it('has a guide to check for every catalog code', () => {
    expect(GUIDE_CODES).toEqual(CATALOG_CODES.toSorted())
  })

  it.each(GUIDE_CODES)('%s names only tools, fields, gates and codes the server has', (code) => {
    expect(unknownNameProblems(code, GUIDES[code], NAMES)).toEqual([])
  })
})

describe('the repair guides ask before removing', () => {
  it('is exactly the tools that remove or drop work', () => {
    expect(DESTRUCTIVE_TOOLS).toEqual(['remove_step', 'disconnect', 'discard_changes'])
  })

  it.each(DESTRUCTIVE_TOOLS)('%s is a real tool', (tool) => {
    expect(TOOL_NAMES).toContain(tool)
  })

  it.each(GUIDE_CODES)('%s asks the user first when its repair removes or drops work', (code) => {
    expect(unaskedDestructiveProblems(code, GUIDES[code])).toEqual([])
  })
})
