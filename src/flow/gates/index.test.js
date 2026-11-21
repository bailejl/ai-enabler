import { describe, expect, it } from 'vitest'
import { GATES, runGate } from './index.js'

const project = { project: { id: 'p-1', name: 'Checkout' }, nodes: [], edges: [] }

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
    const step = {
      id: 's-1',
      type: 'step',
      position: { x: 0, y: 0 },
      data: { label: 'Build', pt: 0, lt: 0, ca: 0, queue: 0 },
    }
    expect(runGate({ ...project, nodes: [step] }, 'data-complete')).toEqual({
      ok: true,
      problems: [],
    })
  })

  it('reports an unknown gate and lists the known ones', () => {
    const result = runGate(project, 'nope')
    expect(result.ok).toBe(false)
    expect(result.problems).toHaveLength(1)
    const [found] = result.problems
    expect(found.code).toBe('GATE_UNKNOWN')
    expect(found.message).toBe('Unknown gate nope. Known gates: data-complete.')
    expect(found.untrusted).toEqual({ gate: 'nope' })
  })

  it.each(['toString', '__proto__', 'constructor'])(
    'does not treat the inherited key %s as a gate',
    (gateId) => {
      expect(runGate(project, gateId).problems[0].code).toBe('GATE_UNKNOWN')
    },
  )

  it.each([undefined, null, 7, {}])('reports the gate name %j as unknown', (gateId) => {
    const [found] = runGate(project, gateId).problems
    expect(found.code).toBe('GATE_UNKNOWN')
    expect(found.message).toBe('Unknown gate (no name). Known gates: data-complete.')
  })

  it('does not coerce a non-text gate name into a registered one', () => {
    const lookalike = { toString: () => 'data-complete' }
    expect(runGate(project, lookalike).problems[0].code).toBe('GATE_UNKNOWN')
  })

  it('lists every known gate, comma separated', () => {
    const registry = { alpha: () => [], beta: () => [] }
    expect(runGate(project, 'nope', registry).problems[0].message).toBe(
      'Unknown gate nope. Known gates: alpha, beta.',
    )
  })

  it('cuts a long gate name in the message and keeps it whole in untrusted', () => {
    const name = 'g'.repeat(200)
    const [found] = runGate(project, name).problems
    expect(found.message).not.toContain('g'.repeat(80))
    expect(found.untrusted).toEqual({ gate: name })
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
