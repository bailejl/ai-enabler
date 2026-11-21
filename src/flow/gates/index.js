import { problem } from '../diagnostics/problem.js'
import { shorten } from '../text.js'
import { dataComplete } from './dataComplete.js'

// The gate table: each id maps to one pure function `(project) => problems[]`. A new gate is added
// by registering it here. Ids are the gate names MCP callers send.
export const GATES = {
  'data-complete': dataComplete,
}

const gateLabel = (gateId) => (typeof gateId === 'string' ? shorten(gateId) : '(no name)')

const unknownGate = (gateId, registry) =>
  problem('GATE_UNKNOWN', {
    params: { gate: gateLabel(gateId), gates: Object.keys(registry).join(', ') },
    untrusted: { gate: gateId },
  })

/**
 * Runs one gate over the in-memory project (the shape the commands work on). A gate only reports;
 * it never changes the project.
 * @param {object} project
 * @param {string} gateId
 * @param {Record<string, (project: object) => object[]>} registry injected so tests can add gates
 * @returns {{ ok: boolean, problems: object[] }}
 */
export const runGate = (project, gateId, registry = GATES) => {
  if (typeof gateId !== 'string' || !Object.hasOwn(registry, gateId)) {
    return { ok: false, problems: [unknownGate(gateId, registry)] }
  }
  const problems = registry[gateId](project)
  return { ok: problems.length === 0, problems }
}
