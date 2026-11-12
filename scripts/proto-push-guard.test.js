import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { findProtoRefs, isProtoRef, refusalMessage } from './proto-push-guard.js'

describe('isProtoRef', () => {
  test.each([
    ['proto/x'],
    ['refs/heads/proto/x'],
    ['+proto/x'],
    ['+refs/heads/proto/x'],
    ['refs/heads/proto/a/b'],
    ['refs/heads/proto/canvas-zoom'],
  ])('accepts %s', (ref) => {
    expect(isProtoRef(ref)).toBe(true)
  })

  test.each([
    ['proto'],
    ['refs/heads/proto'],
    ['prototype-notes'],
    ['refs/heads/prototype-notes'],
    ['feat/proto/x'],
    ['refs/heads/feat/proto/x'],
    ['refs/tags/proto/v1'],
    [''],
    [undefined],
  ])('rejects %s', (ref) => {
    expect(isProtoRef(ref)).toBe(false)
  })
})

const SHA = '1111111111111111111111111111111111111111'
const OTHER_SHA = '2222222222222222222222222222222222222222'
const NULL_SHA = '0000000000000000000000000000000000000000'
const pushLine = (localRef, remoteRef, localSha = SHA) =>
  `${localRef} ${localSha} ${remoteRef} ${OTHER_SHA}`

describe('findProtoRefs', () => {
  test('finds the local proto ref', () => {
    const input = pushLine('refs/heads/proto/canvas-zoom', 'refs/heads/proto/canvas-zoom')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/canvas-zoom'])
  })

  test('finds a proto local ref pushed to another remote name', () => {
    const input = pushLine('refs/heads/proto/canvas-zoom', 'refs/heads/main')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/canvas-zoom'])
  })

  test('finds a proto remote ref from a non-proto local ref', () => {
    const input = pushLine('refs/heads/feat/a', 'refs/heads/proto/b')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b'])
  })

  test('keeps nested proto names whole', () => {
    const input = pushLine('refs/heads/proto/a/b', 'refs/heads/proto/a/b')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/a/b'])
  })

  test('names every proto ref in a mixed push, in input order', () => {
    const input = [
      pushLine('refs/heads/feat/a', 'refs/heads/feat/a'),
      pushLine('refs/heads/proto/b', 'refs/heads/proto/b'),
      pushLine('refs/heads/proto/c', 'refs/heads/proto/c'),
    ].join('\n')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b', 'refs/heads/proto/c'])
  })

  test('lists a ref once when several lines mention it', () => {
    const input = [
      pushLine('refs/heads/proto/b', 'refs/heads/main'),
      pushLine('refs/heads/proto/b', 'refs/heads/proto/b'),
    ].join('\n')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b'])
  })

  test('lists local then remote when both are proto refs and differ', () => {
    const input = pushLine('refs/heads/proto/b', 'refs/heads/proto/c')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b', 'refs/heads/proto/c'])
  })

  test.each([
    ['refs/heads/feat/canvas'],
    ['refs/heads/prototype-notes'],
    ['refs/heads/proto'],
    ['refs/heads/feat/proto/x'],
    ['refs/tags/proto/v1'],
  ])('finds nothing when pushing %s', (ref) => {
    expect(findProtoRefs(pushLine(ref, ref))).toEqual([])
  })

  test('ignores a delete of a proto branch', () => {
    const input = pushLine('(delete)', 'refs/heads/proto/old', NULL_SHA)
    expect(findProtoRefs(input)).toEqual([])
  })

  test('still finds proto refs on other lines next to a delete', () => {
    const input = [
      pushLine('(delete)', 'refs/heads/proto/old', NULL_SHA),
      pushLine('refs/heads/proto/b', 'refs/heads/proto/b'),
    ].join('\n')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b'])
  })

  test.each([[''], ['\n'], ['  \n\n']])('finds nothing in empty input %j', (input) => {
    expect(findProtoRefs(input)).toEqual([])
  })

  test('tolerates a trailing newline', () => {
    const input = `${pushLine('refs/heads/proto/b', 'refs/heads/proto/b')}\n`
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b'])
  })

  test.each([
    ['too few fields', 'refs/heads/proto/b abc refs/heads/proto/b'],
    ['too many fields', `${pushLine('refs/heads/proto/b', 'refs/heads/proto/b')} extra`],
    ['one field', 'refs/heads/proto/b'],
  ])('skips a malformed line with %s', (_name, line) => {
    expect(findProtoRefs(line)).toEqual([])
  })

  test('skips a malformed line but keeps valid ones', () => {
    const input = ['garbage', pushLine('refs/heads/proto/b', 'refs/heads/proto/b')].join('\n')
    expect(findProtoRefs(input)).toEqual(['refs/heads/proto/b'])
  })
})

describe('refusalMessage', () => {
  test('names the ref and points to /prototype graduate', () => {
    const message = refusalMessage(['refs/heads/proto/canvas-zoom'])
    expect(message).toContain('refs/heads/proto/canvas-zoom')
    expect(message).toContain('/prototype graduate')
  })

  test('names every ref', () => {
    const message = refusalMessage(['refs/heads/proto/b', 'refs/heads/proto/c'])
    expect(message).toContain('refs/heads/proto/b')
    expect(message).toContain('refs/heads/proto/c')
  })

  test('says prototype branches stay local', () => {
    expect(refusalMessage(['refs/heads/proto/b'])).toContain('stay local')
  })
})

const CLI_PATH = fileURLToPath(new URL('./proto-push-guard-cli.js', import.meta.url))
const PRE_PUSH_PATH = fileURLToPath(new URL('../.husky/pre-push', import.meta.url))
const runCli = (input) => spawnSync(process.execPath, [CLI_PATH], { input, encoding: 'utf8' })

describe('proto-push-guard CLI', () => {
  test('refuses a proto ref with exit 1 and names it on stderr', () => {
    const result = runCli(pushLine('refs/heads/proto/canvas-zoom', 'refs/heads/proto/canvas-zoom'))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refs/heads/proto/canvas-zoom')
    expect(result.stderr).toContain('/prototype graduate')
  })

  test('passes a non-proto ref silently', () => {
    const result = runCli(pushLine('refs/heads/feat/canvas', 'refs/heads/feat/canvas'))
    expect(result).toMatchObject({ status: 0, stdout: '', stderr: '' })
  })

  test('passes empty stdin silently', () => {
    const result = runCli('')
    expect(result).toMatchObject({ status: 0, stdout: '', stderr: '' })
  })
})

describe('.husky/pre-push', () => {
  const commands = readFileSync(PRE_PUSH_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))

  test('runs the guard before npm test', () => {
    const guardIndex = commands.indexOf('node scripts/proto-push-guard-cli.js')
    const testIndex = commands.indexOf('npm test')
    expect(guardIndex).toBeGreaterThanOrEqual(0)
    expect(guardIndex).toBeLessThan(testIndex)
  })
})
