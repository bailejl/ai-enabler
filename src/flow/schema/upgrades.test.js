import { describe, it, expect } from 'vitest'
import {
  REGISTRY,
  findMissingFixtures,
  findMissingPaths,
  findRegistryProblems,
  upgradeToCurrent,
} from './upgrades.js'
import { isCatalogCode } from '../diagnostics/problem.js'
import { CURRENT_SCHEMA_VERSION, RELEASED_SCHEMA_VERSIONS } from './version.js'
import { validateProjectFile } from './validate.js'

// Fixtures are read here only, so the app bundle never includes them. './fixtures/*.json' skips
// the expected/ folder, which holds snapshots rather than input files.
const fixturesByVersion = Object.fromEntries(
  Object.entries(import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' })).map(
    ([path, fixture]) => [path.match(/([^/]+)\.json$/)[1], fixture],
  ),
)

// A failed upgrade carries exactly one catalog problem.
const onlyProblem = (result) => {
  expect(result.ok).toBe(false)
  expect(result.problems).toHaveLength(1)
  expect(isCatalogCode(result.problems[0].code)).toBe(true)
  return result.problems[0]
}

const deepFreeze = (value) => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const fileAt = (schemaVersion) => ({
  schemaVersion,
  project: { id: 'project-1', name: 'Delivery' },
  nodes: [{ id: 'idea', position: { x: 0, y: 0 }, data: { label: 'Idea' } }],
  edges: [],
})

// Each upgrade records its hop in trail, so the order they ran in is visible in the result.
const addToTrail = (name) => (file) => ({
  ...file,
  trail: [...(file.trail ?? []), name],
})

const multiHopRegistry = [
  { from: '0.0.0', to: '0.1.0', upgrade: addToTrail('0.0.0->0.1.0') },
  { from: '0.1.0', to: '0.2.0', upgrade: addToTrail('0.1.0->0.2.0') },
]

describe('upgradeToCurrent', () => {
  it('runs every upgrade in order and stamps the version after each hop', () => {
    const input = deepFreeze(fileAt('0.0.0'))

    const result = upgradeToCurrent(input, { registry: multiHopRegistry, current: '0.2.0' })

    expect(result).toEqual({
      ok: true,
      file: { ...fileAt('0.2.0'), trail: ['0.0.0->0.1.0', '0.1.0->0.2.0'] },
    })
  })

  it('stamps the hop version itself, even when an upgrade sets a different one', () => {
    const registry = [
      { from: '0.0.0', to: '0.1.0', upgrade: (file) => ({ ...file, schemaVersion: '9.9.9' }) },
    ]

    const result = upgradeToCurrent(fileAt('0.0.0'), { registry, current: '0.1.0' })

    expect(result.file.schemaVersion).toBe('0.1.0')
  })

  it('leaves the input file unchanged', () => {
    const input = fileAt('0.0.0')

    upgradeToCurrent(input, { registry: multiHopRegistry, current: '0.2.0' })

    expect(input).toEqual(fileAt('0.0.0'))
  })

  it('passes a file already at the current version through unchanged', () => {
    const input = deepFreeze(fileAt('0.2.0'))

    const result = upgradeToCurrent(input, { registry: multiHopRegistry, current: '0.2.0' })

    expect(result).toEqual({ ok: true, file: fileAt('0.2.0') })
  })

  it('passes a current-version file through with the real registry', () => {
    const input = deepFreeze(fileAt(CURRENT_SCHEMA_VERSION))

    expect(upgradeToCurrent(input)).toEqual({ ok: true, file: fileAt(CURRENT_SCHEMA_VERSION) })
  })

  it('returns a failure naming the version when an upgrade throws', () => {
    const registry = [
      {
        from: '0.0.0',
        to: '0.1.0',
        upgrade: () => {
          throw new Error('boom')
        },
      },
    ]

    const result = upgradeToCurrent(fileAt('0.0.0'), { registry, current: '0.1.0' })

    const found = onlyProblem(result)
    expect(found.code).toBe('FILE_UPGRADE_FAILED')
    expect(found.message).toContain('0.0.0')
    expect(found.message).toContain('0.1.0')
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'upgraded'],
  ])('returns a failure naming the version when an upgrade returns %s', (_name, returned) => {
    const registry = [{ from: '0.0.0', to: '0.1.0', upgrade: () => returned }]

    const result = upgradeToCurrent(fileAt('0.0.0'), { registry, current: '0.1.0' })

    const found = onlyProblem(result)
    expect(found.code).toBe('FILE_UPGRADE_FAILED')
    expect(found.message).toContain('0.0.0')
    expect(found.message).toContain('0.1.0')
  })

  it('names the failing hop, not the first, when a later upgrade throws', () => {
    const registry = [
      multiHopRegistry[0],
      {
        from: '0.1.0',
        to: '0.2.0',
        upgrade: () => {
          throw new Error('boom')
        },
      },
    ]

    const result = upgradeToCurrent(fileAt('0.0.0'), { registry, current: '0.2.0' })

    const found = onlyProblem(result)
    expect(found.code).toBe('FILE_UPGRADE_FAILED')
    expect(found.message).toContain('0.1.0')
    expect(found.message).toContain('0.2.0')
    expect(found.message).not.toContain('0.0.0')
  })

  it.each([
    ['a version with no upgrade path', fileAt('0.5.0'), '0.5.0'],
    ['a missing version', { ...fileAt('0.0.0'), schemaVersion: undefined }, 'undefined'],
    ['a null file', null, 'undefined'],
  ])('returns a no-upgrade-path failure for %s', (_name, input, version) => {
    const result = upgradeToCurrent(input, { registry: multiHopRegistry, current: '0.2.0' })

    const found = onlyProblem(result)
    expect(found.code).toBe('FILE_NO_UPGRADE_PATH')
    expect(found.message).toContain(version)
    expect(found.message).toContain('0.2.0')
  })

  it('ends with a failure on a cyclic registry', () => {
    const registry = [
      { from: '0.0.0', to: '0.1.0', upgrade: (file) => file },
      { from: '0.1.0', to: '0.0.0', upgrade: (file) => file },
    ]

    const result = upgradeToCurrent(fileAt('0.0.0'), { registry, current: '0.2.0' })

    expect(onlyProblem(result).code).toBe('FILE_NO_UPGRADE_PATH')
  })
})

const hop = (from, to) => ({ from, to, upgrade: (file) => file })

describe('coverage checks', () => {
  const released = ['0.0.0', '0.1.0', '0.2.0']

  it('names every released version without a fixture', () => {
    expect(findMissingFixtures(released, ['0.0.0'])).toEqual(['0.1.0', '0.2.0'])
  })

  it('names no fixture as missing when each released version has one', () => {
    expect(findMissingFixtures(released, released)).toEqual([])
  })

  it('does not flag a fixture for an unreleased version', () => {
    expect(findMissingFixtures(['0.0.0'], ['0.0.0', '0.9.0'])).toEqual([])
  })

  it('names every released version with no upgrade path to current', () => {
    const registry = [hop('0.0.0', '0.1.0')]

    expect(findMissingPaths(released, registry, '0.2.0')).toEqual(['0.0.0', '0.1.0'])
  })

  it('names only the released versions that have no hop onward', () => {
    const registry = [hop('0.0.0', '0.2.0')]

    expect(findMissingPaths(released, registry, '0.2.0')).toEqual(['0.1.0'])
  })

  it('names no version when every hop is present', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.1.0', '0.2.0')]

    expect(findMissingPaths(released, registry, '0.2.0')).toEqual([])
  })

  it('counts the current version as reaching itself with no hops', () => {
    expect(findMissingPaths(['0.0.0'], [], '0.0.0')).toEqual([])
  })

  it('ends on a cyclic registry and names the versions that cannot reach current', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.1.0', '0.0.0')]

    expect(findMissingPaths(released, registry, '0.2.0')).toEqual(['0.0.0', '0.1.0'])
  })
})

describe('findRegistryProblems', () => {
  it('finds no problem in an empty registry', () => {
    expect(findRegistryProblems([], '0.0.0')).toEqual([])
  })

  it('finds no problem in a contiguous registry ending at current', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.1.0', '0.2.0')]

    expect(findRegistryProblems(registry, '0.2.0')).toEqual([])
  })

  it.each([
    ['from greater than to', [hop('0.1.0', '0.0.0')], '0.1.0', 'The upgrade 0.1.0 to 0.0.0'],
    ['from equal to to', [hop('0.1.0', '0.1.0')], '0.1.0', 'The upgrade 0.1.0 to 0.1.0'],
    ['a from that is not SemVer', [hop('1.0', '0.1.0')], '0.1.0', 'The upgrade 1.0 to 0.1.0'],
    ['a to that is not SemVer', [hop('0.1.0', '1.0')], '0.1.0', 'The upgrade 0.1.0 to 1.0'],
  ])('flags %s', (_name, registry, current, expected) => {
    expect(findRegistryProblems(registry, current)).toEqual([
      `${expected} must go from a lower version to a higher one.`,
    ])
  })

  it('flags two upgrades that start at the same version', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.0.0', '0.2.0')]

    // Both reports are intended: the duplicate start, and the gap it leaves between the two hops.
    expect(findRegistryProblems(registry, '0.2.0')).toEqual([
      'More than one upgrade starts at 0.0.0.',
      'The upgrade 0.0.0 to 0.1.0 is followed by one that starts at 0.0.0.',
    ])
  })

  it('flags a gap between one upgrade and the next', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.2.0', '0.3.0')]

    expect(findRegistryProblems(registry, '0.3.0')).toEqual([
      'The upgrade 0.0.0 to 0.1.0 is followed by one that starts at 0.2.0.',
    ])
  })

  it('flags an upgrade that goes past the current version', () => {
    expect(findRegistryProblems([hop('0.0.0', '0.3.0')], '0.2.0')).toEqual([
      'The upgrade 0.0.0 to 0.3.0 goes past the current version 0.2.0.',
    ])
  })

  it('flags a current version that is not SemVer', () => {
    expect(findRegistryProblems([hop('0.0.0', '0.1.0')], '1.0')).toEqual([
      'The current version 1.0 is not a valid version.',
    ])
  })

  it('flags a cycle through its backward hop', () => {
    const registry = [hop('0.0.0', '0.1.0'), hop('0.1.0', '0.0.0')]

    expect(findRegistryProblems(registry, '0.2.0')).toEqual([
      'The upgrade 0.1.0 to 0.0.0 must go from a lower version to a higher one.',
    ])
  })

  it('reports every problem, not only the first', () => {
    const registry = [hop('0.1.0', '0.0.0'), hop('0.0.0', '0.5.0')]

    expect(findRegistryProblems(registry, '0.2.0')).toEqual([
      'The upgrade 0.1.0 to 0.0.0 must go from a lower version to a higher one.',
      'The upgrade 0.0.0 to 0.5.0 goes past the current version 0.2.0.',
    ])
  })
})

describe('the real registry', () => {
  it('releases the current version', () => {
    expect(RELEASED_SCHEMA_VERSIONS).toContain(CURRENT_SCHEMA_VERSION)
  })

  it('has no structural problems', () => {
    expect(findRegistryProblems(REGISTRY, CURRENT_SCHEMA_VERSION)).toEqual([])
  })

  it('has a fixture for every released version', () => {
    expect(findMissingFixtures(RELEASED_SCHEMA_VERSIONS, Object.keys(fixturesByVersion))).toEqual(
      [],
    )
  })

  it('lets every released version reach the current version', () => {
    expect(findMissingPaths(RELEASED_SCHEMA_VERSIONS, REGISTRY, CURRENT_SCHEMA_VERSION)).toEqual([])
  })

  it('has fixture files for exactly the released versions', () => {
    expect(Object.keys(fixturesByVersion).sort()).toEqual([...RELEASED_SCHEMA_VERSIONS].sort())
  })
})

describe.each(RELEASED_SCHEMA_VERSIONS)('the %s fixture', (version) => {
  const upgradeFixture = () => {
    const fixture = deepFreeze(structuredClone(fixturesByVersion[version]))
    return { fixture, result: upgradeToCurrent(fixture) }
  }

  it('is stamped with its own version', () => {
    expect(fixturesByVersion[version].schemaVersion).toBe(version)
  })

  it('upgrades to a valid current-version file', () => {
    const { result } = upgradeFixture()

    expect(result.ok).toBe(true)
    expect(result.file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(validateProjectFile(result.file)).toEqual({ ok: true, problems: [] })
  })

  it('upgrades to its expected output', async () => {
    const { result } = upgradeFixture()

    // Once real hops exist, hand-review this expected file before accepting a -u update: a
    // regenerated snapshot would otherwise bless whatever the upgrade now does.
    expect(result.ok).toBe(true)
    await expect(`${JSON.stringify(result.file, null, 2)}\n`).toMatchFileSnapshot(
      `./fixtures/expected/${version}.json`,
    )
  })

  it('is left unchanged by the upgrade', () => {
    const { fixture } = upgradeFixture()

    expect(fixture).toEqual(fixturesByVersion[version])
  })
})
