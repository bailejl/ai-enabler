import { CURRENT_SCHEMA_VERSION, compareSemver, parseSemver } from './version.js'

// Ordered upgrade hops, oldest first. Each is { from, to, upgrade }, where upgrade takes a file at
// `from` and returns a new file in the `to` shape. It must not mutate its input. upgradeToCurrent
// stamps schemaVersion itself, so an upgrade only changes the data.
export const REGISTRY = []

// The hops from a version up to current, or null when the chain breaks. Bounded by the registry
// length, so a cyclic registry ends instead of looping.
const findPath = (registry, from, current) => {
  const hops = []
  let version = from
  for (let taken = 0; taken < registry.length && version !== current; taken += 1) {
    const hop = registry.find((candidate) => candidate.from === version)
    if (!hop) return null
    hops.push(hop)
    version = hop.to
  }
  return version === current ? hops : null
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// An upgrade that returns anything but an object counts as a failed upgrade, like a throw.
const applyHop = (file, hop) => {
  const upgraded = hop.upgrade(file)
  if (!isPlainObject(upgraded)) throw new TypeError('upgrade did not return an object')
  return { ...upgraded, schemaVersion: hop.to }
}

export const upgradeToCurrent = (
  file,
  { registry = REGISTRY, current = CURRENT_SCHEMA_VERSION } = {},
) => {
  const hops = findPath(registry, file?.schemaVersion, current)
  if (!hops) {
    return {
      ok: false,
      message: `This file uses schema ${file?.schemaVersion}, which this app cannot upgrade to ${current}.`,
    }
  }
  let upgraded = file
  for (const hop of hops) {
    try {
      upgraded = applyHop(upgraded, hop)
    } catch {
      return {
        ok: false,
        message: `This file could not be upgraded from schema ${hop.from} to ${hop.to}.`,
      }
    }
  }
  return { ok: true, file: upgraded }
}

export const findMissingFixtures = (released, fixtureVersions) =>
  released.filter((version) => !fixtureVersions.includes(version))

export const findMissingPaths = (released, registry, current) =>
  released.filter((version) => findPath(registry, version, current) === null)

const describeHop = (hop) => `The upgrade ${hop.from} to ${hop.to}`

const isIncreasing = (hop) =>
  parseSemver(hop.from) !== null &&
  parseSemver(hop.to) !== null &&
  compareSemver(hop.from, hop.to) < 0

const findOutOfOrderHops = (registry) =>
  registry
    .filter((hop) => !isIncreasing(hop))
    .map((hop) => `${describeHop(hop)} must go from a lower version to a higher one.`)

const findDuplicateStarts = (registry) => {
  const starts = registry.map((hop) => hop.from)
  const duplicates = new Set(starts.filter((from, index) => starts.indexOf(from) !== index))
  return [...duplicates].map((from) => `More than one upgrade starts at ${from}.`)
}

const findGaps = (registry) =>
  registry
    .slice(1)
    .map((next, index) => ({ previous: registry[index], next }))
    .filter(({ previous, next }) => previous.to !== next.from)
    .map(
      ({ previous, next }) =>
        `${describeHop(previous)} is followed by one that starts at ${next.from}.`,
    )

const findHopsPastCurrent = (registry, current) =>
  parseSemver(current) === null
    ? [`The current version ${current} is not a valid version.`]
    : registry
        .filter((hop) => parseSemver(hop.to) !== null && compareSemver(hop.to, current) > 0)
        .map((hop) => `${describeHop(hop)} goes past the current version ${current}.`)

// Every structural problem with the registry, as messages. Empty when the registry is sound.
export const findRegistryProblems = (registry, current) => [
  ...findOutOfOrderHops(registry),
  ...findDuplicateStarts(registry),
  ...findGaps(registry),
  ...findHopsPastCurrent(registry, current),
]
