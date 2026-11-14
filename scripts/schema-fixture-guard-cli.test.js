import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { DEFAULT_BASE, runGuard } from './schema-fixture-guard-cli.js'

const FIXTURE = 'src/flow/schema/fixtures/0.0.0.json'
const TIMEOUT_MS = 30_000
const CLI_PATH = fileURLToPath(new URL('./schema-fixture-guard-cli.js', import.meta.url))

const GIT_DIFF_ARGS = (base) => [
  '-c',
  'core.quotePath=false',
  'diff',
  '--name-status',
  '--no-renames',
  `${base}...HEAD`,
]

const gitResult = (overrides) => ({ status: 0, stdout: '', stderr: '', ...overrides })
const fakeRunner = (result) => {
  const calls = []
  const run = (args) => {
    calls.push(args)
    return result
  }
  return { run, calls }
}

describe('runGuard', () => {
  test('passes with exit 0 when only a fixture is added', () => {
    const { run } = fakeRunner(gitResult({ stdout: `A\t${FIXTURE}\n` }))
    expect(runGuard({ run })).toMatchObject({ exitCode: 0 })
  })

  test('passes on an empty diff', () => {
    const { run } = fakeRunner(gitResult())
    expect(runGuard({ run })).toMatchObject({ exitCode: 0 })
  })

  test('fails non-zero and names the changed fixture', () => {
    const { run } = fakeRunner(gitResult({ stdout: `M\t${FIXTURE}\n` }))
    const { exitCode, message } = runGuard({ run })
    expect(exitCode).toBe(1)
    expect(message).toContain(`M  ${FIXTURE}`)
  })

  test('diffs origin/main...HEAD without rename detection by default', () => {
    const { run, calls } = fakeRunner(gitResult())
    runGuard({ run })
    expect(DEFAULT_BASE).toBe('origin/main')
    expect(calls).toEqual([GIT_DIFF_ARGS('origin/main')])
  })

  test('diffs against a given base', () => {
    const { run, calls } = fakeRunner(gitResult())
    runGuard({ run, base: 'release' })
    expect(calls).toEqual([GIT_DIFF_ARGS('release')])
  })

  test('runs git with unquoted paths so a quoted path cannot slip past the fixture pattern', () => {
    const { run, calls } = fakeRunner(gitResult())
    runGuard({ run })
    expect(calls[0].slice(0, 2)).toEqual(['-c', 'core.quotePath=false'])
  })

  test.each([['-x'], ['--output=guard.txt']])(
    'rejects base %s as an option without running git',
    (base) => {
      const { run, calls } = fakeRunner(gitResult())
      const { exitCode, message } = runGuard({ run, base })
      expect(exitCode).toBe(1)
      expect(message).toContain(base)
      expect(calls).toEqual([])
    },
  )

  test('fails closed when git exits non-zero, naming the base and git error', () => {
    const { run } = fakeRunner(
      gitResult({ status: 128, stderr: 'fatal: bad revision\n', stdout: `M\t${FIXTURE}\n` }),
    )
    const { exitCode, message } = runGuard({ run })
    expect(exitCode).toBe(1)
    expect(message).toContain('origin/main')
    expect(message).toContain('fatal: bad revision')
  })

  test('fails closed when git cannot be spawned', () => {
    const { run } = fakeRunner({ error: new Error('spawn git ENOENT'), status: null })
    const { exitCode, message } = runGuard({ run })
    expect(exitCode).toBe(1)
    expect(message).toContain('spawn git ENOENT')
  })

  test('fails closed with the exit status when git gives no error text', () => {
    const { run } = fakeRunner(gitResult({ status: 2 }))
    expect(runGuard({ run }).message).toContain('git exited 2')
  })
})

const runCli = (...args) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', timeout: TIMEOUT_MS })

describe('schema-fixture-guard CLI', () => {
  test('exits 0 and reports no changes when the base is HEAD (empty diff)', () => {
    const result = runCli('HEAD')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('no released fixtures changed')
  })

  test('exits non-zero with an error on stderr when the base looks like an option', () => {
    const result = runCli('--output=guard-option-test.txt')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--output=guard-option-test.txt')
  })

  test('exits non-zero with an error on stderr when the base ref cannot be resolved', () => {
    const result = runCli('no-such-ref-for-guard-test')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('no-such-ref-for-guard-test')
  })
})
