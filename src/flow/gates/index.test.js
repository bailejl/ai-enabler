import { describe, expect, it } from 'vitest'
import { MAX_ECHOED_TEXT } from '../text.js'
import { GATES, runGate } from './index.js'

const project = { project: { id: 'p-1', name: 'Checkout' }, nodes: [], edges: [] }
const registry = { alpha: () => [], beta: () => [] }

const step = (id, label, data = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label, ...data },
})

describe('GATES', () => {
  it('registers data-complete', () => {
    expect(Object.keys(GATES)).toEqual(['data-complete'])
  })
})

describe('runGate', () => {
  it('runs data-complete from the default registry', () => {
    const result = runGate(project, 'data-complete')
    expect(result.ok).toBe(false)
    expect(result.problems.map((found) => found.code)).toEqual(['GATE_PROJECT_EMPTY'])
  })

  it('is ok when the gate reports nothing', () => {
    const built = step('s-1', 'Build', { pt: 0, lt: 0, ca: 0, queue: 0 })
    expect(runGate({ ...project, nodes: [built] }, 'data-complete')).toEqual({
      ok: true,
      problems: [],
    })
  })

  it('lists the default gate in an unknown-gate message', () => {
    expect(runGate(project, 'nope').problems[0].message).toBe(
      'Unknown gate nope. Known gates: data-complete.',
    )
  })

  it('reports an unknown gate with its code and the raw name in untrusted', () => {
    const result = runGate(project, 'nope', registry)
    expect(result.ok).toBe(false)
    expect(result.problems).toHaveLength(1)
    const [found] = result.problems
    expect(found.code).toBe('GATE_UNKNOWN')
    expect(found.message).toBe('Unknown gate nope. Known gates: alpha, beta.')
    expect(found.untrusted).toEqual({ gate: 'nope' })
  })

  it.each(['toString', '__proto__', 'constructor'])(
    'does not treat the inherited key %s as a gate',
    (gateId) => {
      expect(runGate(project, gateId, registry).problems[0].code).toBe('GATE_UNKNOWN')
    },
  )

  it.each([undefined, null, 7, {}, '', '   '])('reports the gate name %j as unknown', (gateId) => {
    const [found] = runGate(project, gateId, registry).problems
    expect(found.code).toBe('GATE_UNKNOWN')
    expect(found.message).toBe('Unknown gate (no name). Known gates: alpha, beta.')
  })

  it('does not coerce a non-text gate name into a registered one', () => {
    const lookalike = { toString: () => 'alpha' }
    expect(runGate(project, lookalike, registry).problems[0].code).toBe('GATE_UNKNOWN')
  })

  it('cuts a long gate name in the message and keeps it whole in untrusted', () => {
    const name = 'g'.repeat(200)
    const [found] = runGate(project, name, registry).problems
    expect(found.message).not.toContain('g'.repeat(MAX_ECHOED_TEXT))
    expect(found.untrusted).toEqual({ gate: name })
  })

  it.each([null, undefined])(
    'rejects the project %j with CMD_NO_PROJECT without throwing',
    (none) => {
      const result = runGate(none, 'data-complete')
      expect(result.ok).toBe(false)
      const [found] = result.problems
      expect(found.code).toBe('CMD_NO_PROJECT')
      expect(found.message).toBe('No project is open. Call open_project or create_project first.')
    },
  )

  it('reports an unknown gate before a missing project', () => {
    expect(runGate(null, 'nope').problems[0].code).toBe('GATE_UNKNOWN')
  })

  it('leaves an incomplete project unchanged', () => {
    const incomplete = { ...project, nodes: [step('s-1', 'Review')] }
    const before = structuredClone(incomplete)
    expect(runGate(incomplete, 'data-complete').ok).toBe(false)
    expect(incomplete).toEqual(before)
  })

  it('runs a gate registered as one function, and nothing else', () => {
    const marker = { code: 'GATE_PROJECT_EMPTY' }
    const seen = []
    const registry = {
      probe: (given) => {
        seen.push(given)
        return [marker]
      },
    }
    const result = runGate(project, 'probe', registry)
    expect(result).toEqual({ ok: false, problems: [marker] })
    expect(seen).toEqual([project])
    expect(runGate(project, 'data-complete', registry).problems[0].message).toContain(
      'Known gates: probe.',
    )
  })

  it('is ok when a registered gate returns no problems', () => {
    expect(runGate(project, 'quiet', { quiet: () => [] })).toEqual({ ok: true, problems: [] })
  })
})
