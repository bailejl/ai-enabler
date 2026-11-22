import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findStaleArtifacts, staleMessage } from './plugin-bundle-check.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ARTIFACTS = ['plugin/server/aie-mcp.js', 'plugin/schema/project-0.1.0.json']

const readAll = (dir) =>
  Object.fromEntries(
    ARTIFACTS.map((name) => {
      try {
        return [name, readFileSync(path.join(dir, name))]
      } catch {
        return [name, undefined]
      }
    }),
  )

// The build writes `server/` and `schema/` side by side, so a temp folder named `plugin` has the
// same layout as the committed one.
const rebuild = (pluginDir) =>
  spawnSync(
    'npx',
    ['vite', 'build', '-c', 'vite.mcp.config.js', '--outDir', path.join(pluginDir, 'server')],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
  )

const scratch = mkdtempSync(path.join(tmpdir(), 'aie-plugin-check-'))
try {
  const pluginDir = path.join(scratch, 'plugin')
  const build = rebuild(pluginDir)
  if (build.status !== 0) {
    process.stderr.write('The plugin build failed, so the bundle could not be checked.\n')
    process.exitCode = 1
  } else {
    const stale = findStaleArtifacts({
      built: readAll(scratch),
      committed: readAll(ROOT),
    })
    if (stale.length > 0) {
      process.stderr.write(`${staleMessage(stale)}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write('Plugin bundle is up to date.\n')
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
