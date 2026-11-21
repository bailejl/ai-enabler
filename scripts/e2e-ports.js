// Dev ports for e2e runs fall in 3100–3999 and preview ports in 4100–4999, so the ranges never overlap.
export const DEV_PORT_MIN = 3100
export const DEV_PORT_SPAN = 900
export const PREVIEW_OFFSET = 1000

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

// FNV-1a: a small, stable string hash, so one checkout always gets the same port.
const fnv1a = (text) =>
  [...text].reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME) >>> 0,
    FNV_OFFSET,
  )

export const derivedPort = (root) => DEV_PORT_MIN + (fnv1a(root) % DEV_PORT_SPAN)

const explicitPort = (value) => Number(value) || undefined

// Each git worktree gets its own ports, derived from its root path. PORT and PREVIEW_PORT override them.
// A derived port never reuses a running server: a hash collision then fails loudly instead of
// silently testing another worktree's code. Only an explicit PORT outside CI may reuse one.
export const e2ePorts = ({ env, root }) => {
  const explicit = explicitPort(env.PORT)
  const port = explicit ?? derivedPort(root)
  return {
    port,
    previewPort: explicitPort(env.PREVIEW_PORT) ?? port + PREVIEW_OFFSET,
    reuseDevServer: explicit !== undefined && !env.CI,
  }
}
