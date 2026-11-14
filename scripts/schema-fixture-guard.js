// Released input fixtures are immutable: only expected/ snapshots may change after release.
// Matches top-level fixture JSON only, so fixtures/expected/ is exempt by construction.
export const RELEASED_FIXTURE_PATH = /^src\/flow\/schema\/fixtures\/[^/]+\.json$/

const ADDED_STATUS = 'A'
const FIELD_SEPARATOR = '\t'

const violationsInLine = (line) => {
  const [status, ...paths] = line.split(FIELD_SEPARATOR)
  if (status === ADDED_STATUS) return []
  return paths.filter((path) => RELEASED_FIXTURE_PATH.test(path)).map((path) => ({ path, status }))
}

// diffText is `git diff --name-status --no-renames <base>...HEAD`. R and C rows carry two
// paths; the pure check rejects them even though --no-renames means git never emits them.
export const findFixtureViolations = (diffText) =>
  diffText
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap(violationsInLine)

export const violationMessage = (violations) =>
  [
    'Released schema fixtures are immutable: only adding a new fixture is allowed.',
    ...violations.map(({ path, status }) => `  - ${status}  ${path}`),
    'To change the schema, add a new version and fixture; see docs/schema-versioning.md.',
  ].join('\n')
