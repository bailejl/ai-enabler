import { describe, expect, test } from 'vitest'
import { DEV_PORT_MIN, DEV_PORT_SPAN, derivedPort, e2ePorts } from './e2e-ports.js'

const MAIN = '/Users/dev/repos/ai-enabler'
const WORKTREE = '/Users/dev/repos/ai-enabler/.claude/worktrees/agent-1'

describe('derivedPort', () => {
  test('two worktree paths get different ports', () => {
    expect(derivedPort(MAIN)).not.toBe(derivedPort(WORKTREE))
  })

  test('the same path always gets the same port', () => {
    expect(derivedPort(WORKTREE)).toBe(derivedPort(WORKTREE))
  })

  test.each([MAIN, WORKTREE, '/', 'C:\\repos\\ai-enabler', '/tmp/ünïcode'])(
    '%s maps into the dev range 3100–3999',
    (root) => {
      const port = derivedPort(root)
      expect(port).toBeGreaterThanOrEqual(DEV_PORT_MIN)
      expect(port).toBeLessThan(DEV_PORT_MIN + DEV_PORT_SPAN)
    },
  )
})

describe('e2ePorts', () => {
  test('with no env, the ports come from the root and no dev server is reused', () => {
    const port = derivedPort(WORKTREE)
    expect(e2ePorts({ env: {}, root: WORKTREE })).toEqual({
      port,
      previewPort: port + 1000,
      reuseDevServer: false,
    })
  })

  test('the preview port of any derived port stays outside the dev range', () => {
    const { previewPort } = e2ePorts({ env: {}, root: MAIN })
    expect(previewPort).toBeGreaterThanOrEqual(DEV_PORT_MIN + DEV_PORT_SPAN)
  })

  test('an explicit PORT wins, its preview follows it, and its dev server may be reused', () => {
    expect(e2ePorts({ env: { PORT: '3417' }, root: WORKTREE })).toEqual({
      port: 3417,
      previewPort: 4417,
      reuseDevServer: true,
    })
  })

  test('an explicit PREVIEW_PORT wins over the derived preview port', () => {
    expect(e2ePorts({ env: { PREVIEW_PORT: '5000' }, root: WORKTREE }).previewPort).toBe(5000)
  })

  test('in CI an explicit PORT never reuses a dev server', () => {
    expect(e2ePorts({ env: { PORT: '3417', CI: 'true' }, root: WORKTREE }).reuseDevServer).toBe(
      false,
    )
  })

  test.each(['', 'abc', '0'])('PORT %j is ignored and the derived port is used', (value) => {
    expect(e2ePorts({ env: { PORT: value }, root: WORKTREE }).port).toBe(derivedPort(WORKTREE))
  })
})
