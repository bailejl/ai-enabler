import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkBundle } from './plugin-bundle-check.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// Every file the temp build wrote under `plugin/`, keyed by its repo path. The build config is the
// only place that says which artifacts exist, so this walk has no list of its own to drift.
const readBuilt = (scratch) =>
  Object.fromEntries(
    readdirSync(path.join(scratch, 'plugin'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(scratch, path.join(entry.parentPath, entry.name)))
      .map((name) => [name.split(path.sep).join('/'), readFileSync(path.join(scratch, name))]),
  )

const readCommitted = (names) =>
  Object.fromEntries(
    names.map((name) => {
      try {
        return [name, readFileSync(path.join(ROOT, name))]
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
  const build = rebuild(path.join(scratch, 'plugin'))
  if (build.status !== 0) {
    process.stderr.write('The plugin build failed, so the bundle could not be checked.\n')
    process.exitCode = 1
  } else {
    const built = readBuilt(scratch)
    const { ok, message } = checkBundle({ built, committed: readCommitted(Object.keys(built)) })
    process.stdout.write(ok ? `${message}\n` : '')
    process.stderr.write(ok ? '' : `${message}\n`)
    process.exitCode = ok ? 0 : 1
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
