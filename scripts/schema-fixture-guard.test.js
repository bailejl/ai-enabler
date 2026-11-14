import { describe, expect, test } from 'vitest'
import { findFixtureViolations, violationMessage } from './schema-fixture-guard.js'

const FIXTURE = 'src/flow/schema/fixtures/0.0.0.json'
const EXPECTED = 'src/flow/schema/fixtures/expected/0.0.0.json'
const row = (status, ...paths) => [status, ...paths].join('\t')

describe('findFixtureViolations', () => {
  test('passes an added fixture', () => {
    expect(findFixtureViolations(row('A', FIXTURE))).toEqual([])
  })

  test.each([['M'], ['D'], ['R100'], ['C100'], ['T']])(
    'fails status %s on a released fixture and reports path and status',
    (status) => {
      expect(findFixtureViolations(row(status, FIXTURE))).toEqual([{ path: FIXTURE, status }])
    },
  )

  test('fails a rename out of a released fixture, naming the fixture path', () => {
    const diff = row('R100', FIXTURE, 'docs/old-fixture.json')
    expect(findFixtureViolations(diff)).toEqual([{ path: FIXTURE, status: 'R100' }])
  })

  test('fails a rename onto a released fixture, naming the fixture path', () => {
    const diff = row('R100', 'docs/old-fixture.json', FIXTURE)
    expect(findFixtureViolations(diff)).toEqual([{ path: FIXTURE, status: 'R100' }])
  })

  test('fails closed on an unknown status', () => {
    expect(findFixtureViolations(row('U', FIXTURE))).toEqual([{ path: FIXTURE, status: 'U' }])
  })

  test('fails a copy that overwrites a released fixture', () => {
    const diff = row('C100', 'docs/seed.json', FIXTURE)
    expect(findFixtureViolations(diff)).toEqual([{ path: FIXTURE, status: 'C100' }])
  })

  test.each([[''], ['\n']])('passes an empty diff %j', (diff) => {
    expect(findFixtureViolations(diff)).toEqual([])
  })

  test('allows modifying an expected-output file', () => {
    expect(findFixtureViolations(row('M', EXPECTED))).toEqual([])
  })

  test.each([
    ['src/flow/schema/validate.js'],
    ['src/flow/schema/fixtures/README.md'],
    ['src/flow/schema/fixtures/nested/0.0.0.json'],
    ['other/src/flow/schema/fixtures/0.0.0.json'],
    ['src/flow/schema/fixtures/0.0.0.json.bak'],
  ])('ignores a modified non-fixture path %s', (path) => {
    expect(findFixtureViolations(row('M', path))).toEqual([])
  })

  test('reports every violation among mixed rows and ignores allowed ones', () => {
    const diff = [
      row('A', 'src/flow/schema/fixtures/1.0.0.json'),
      row('M', FIXTURE),
      row('M', EXPECTED),
      row('D', 'src/flow/schema/fixtures/0.1.0.json'),
      '',
    ].join('\n')
    expect(findFixtureViolations(diff)).toEqual([
      { path: FIXTURE, status: 'M' },
      { path: 'src/flow/schema/fixtures/0.1.0.json', status: 'D' },
    ])
  })
})

describe('violationMessage', () => {
  test('lists each violation with status and path', () => {
    const message = violationMessage([
      { path: FIXTURE, status: 'M' },
      { path: 'src/flow/schema/fixtures/0.1.0.json', status: 'D' },
    ])
    expect(message).toContain(`M  ${FIXTURE}`)
    expect(message).toContain('D  src/flow/schema/fixtures/0.1.0.json')
  })
})
