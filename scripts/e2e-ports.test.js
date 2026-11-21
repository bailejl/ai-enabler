import { describe, expect, test } from 'vitest'
import { derivedPort, e2ePorts } from './e2e-ports.js'

const MAIN = '/Users/dev/repos/ai-enabler'
const WORKTREE = '/Users/dev/repos/ai-enabler/.claude/worktrees/agent-1'
const ROOTS = [MAIN, WORKTREE, '/', 'C:\\repos\\ai-enabler', '/tmp/ünïcode']

describe('derivedPort', () => {
  // FNV-1a 32-bit of "a" is 0xe40c292c (the published test vector); 0xe40c292c % 900 = 520.
  test('"a" hashes to the published FNV-1a vector, so it gets port 3620', () => {
    expect(derivedPort('a')).toBe(3620)
  })

  test('the same path gets the same port on every run and machine', () => {
    expect(derivedPort(WORKTREE)).toBe(3591)
    expect(derivedPort(MAIN)).toBe(3921)
  })

  test('two worktree paths get different ports', () => {
    expect(derivedPort(MAIN)).not.toBe(derivedPort(WORKTREE))
  })
})

describe('e2ePorts', () => {
  test.each(ROOTS)('%s gets a dev port in 3100–3999 and a preview port in 4100–4999', (root) => {
    const { devPort, previewPort } = e2ePorts({ env: {}, root })
    expect(devPort).toBeGreaterThanOrEqual(3100)
    expect(devPort).toBeLessThanOrEqual(3999)
    expect(previewPort).toBeGreaterThanOrEqual(4100)
    expect(previewPort).toBeLessThanOrEqual(4999)
  })

  test('with no env, the ports come from the root and no dev server is reused', () => {
    expect(e2ePorts({ env: {}, root: WORKTREE })).toEqual({
      devPort: 3591,
      previewPort: 4591,
      reuseDevServer: false,
    })
  })

  test('an explicit PORT wins, its preview follows it, and its dev server may be reused', () => {
    expect(e2ePorts({ env: { PORT: '3417' }, root: WORKTREE })).toEqual({
      devPort: 3417,
      previewPort: 4417,
      reuseDevServer: true,
    })
  })

  test('an explicit PREVIEW_PORT wins and leaves the dev port and reuse unchanged', () => {
    expect(e2ePorts({ env: { PREVIEW_PORT: '5000' }, root: WORKTREE })).toEqual({
      devPort: 3591,
      previewPort: 5000,
      reuseDevServer: false,
    })
  })

  test('explicit PORT and PREVIEW_PORT are both used as given', () => {
    expect(e2ePorts({ env: { PORT: '3417', PREVIEW_PORT: '5000' }, root: WORKTREE })).toEqual({
      devPort: 3417,
      previewPort: 5000,
      reuseDevServer: true,
    })
  })

  test('in CI an explicit PORT never reuses a dev server', () => {
    expect(e2ePorts({ env: { PORT: '3417', CI: 'true' }, root: WORKTREE })).toEqual({
      devPort: 3417,
      previewPort: 4417,
      reuseDevServer: false,
    })
  })

  test.each(['', 'abc', '0'])('PORT %j is ignored: derived ports, no reuse', (value) => {
    expect(e2ePorts({ env: { PORT: value }, root: WORKTREE })).toEqual({
      devPort: 3591,
      previewPort: 4591,
      reuseDevServer: false,
    })
  })

  test.each(['', 'abc', '0'])(
    'PREVIEW_PORT %j is ignored: the preview follows the port',
    (value) => {
      expect(e2ePorts({ env: { PREVIEW_PORT: value }, root: WORKTREE }).previewPort).toBe(4591)
    },
  )
})
