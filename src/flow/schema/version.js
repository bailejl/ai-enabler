export const CURRENT_SCHEMA_VERSION = '0.1.0'
export const RELEASED_SCHEMA_VERSIONS = ['0.0.0', '0.1.0']

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const parseSemver = (value) => {
  if (typeof value !== 'string') return null
  const match = SEMVER_PATTERN.exec(value)
  if (!match) return null
  const parts = match.slice(1).map(Number)
  if (!parts.every(Number.isSafeInteger)) return null
  return Object.freeze(parts)
}

export const compareSemver = (left, right) => {
  const leftParts = parseSemver(left)
  const rightParts = parseSemver(right)
  if (!leftParts || !rightParts) {
    throw new TypeError(`compareSemver needs two SemVer strings, got ${left} and ${right}`)
  }
  const firstDifference = leftParts.findIndex((part, index) => part !== rightParts[index])
  if (firstDifference === -1) return 0
  return Math.sign(leftParts[firstDifference] - rightParts[firstDifference])
}
