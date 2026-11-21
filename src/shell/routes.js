// Hash routes for app navigation. This lives in shell/, not flow/, because it maps URLs to
// views rather than modelling a value stream. GitHub Pages serves only index.html, so every
// route sits after the `#`.

export const ROUTE = Object.freeze({ HOME: 'home', PROJECT: 'project' })

const HOME_HASH = '#/'
const PROJECT_PREFIX = '#/projects/'
// One id segment, then at most one trailing slash.
const PROJECT_HASH_PATTERN = new RegExp(`^${PROJECT_PREFIX}([^/]+)/?$`)

const HOME = Object.freeze({ route: Object.freeze({ name: ROUTE.HOME }), hash: HOME_HASH })

const decodeSegment = (segment) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

// Returns the route for a `location.hash` value and its canonical hash. A project id keeps
// the spelling it was written with, so a shared link is never re-encoded.
export const resolveHash = (hash) => {
  const match = PROJECT_HASH_PATTERN.exec(hash)
  if (!match) return HOME
  const [, segment] = match
  const id = decodeSegment(segment)
  if (id === null) return HOME
  return { route: { name: ROUTE.PROJECT, id }, hash: `${PROJECT_PREFIX}${segment}` }
}

export const toHash = (route) =>
  route.name === ROUTE.PROJECT ? `${PROJECT_PREFIX}${encodeURIComponent(route.id)}` : HOME_HASH

// The hash to write in place of a non-canonical one, or null when the hash is already
// canonical. Pure: the caller does the history write.
export const rewriteTarget = (hash) => {
  const canonical = resolveHash(hash).hash
  return canonical === hash ? null : canonical
}
