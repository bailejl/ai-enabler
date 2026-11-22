import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkBundle } from './plugin-bundle-check.js'
import { readBundleFiles } from './plugin-bundle-files.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The build command lives in package.json (`build:plugin`), so it has one source. The build writes
// `server/` and `schema/` side by side, so a temp folder named `plugin` has the same layout as the
// committed one.
const rebuild = (pluginDir) =>
  spawnSync(
    'npm',
    ['run', '--silent', 'build:plugin', '--', '--outDir', path.join(pluginDir, 'server')],
    {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  )

const scratch = mkdtempSync(path.join(tmpdir(), 'aie-plugin-check-'))
try {
  const build = rebuild(path.join(scratch, 'plugin'))
  if (build.status !== 0) {
    process.stderr.write('The plugin build failed, so the bundle could not be checked.\n')
    process.exitCode = 1
  } else {
    const { ok, message } = checkBundle({
      built: readBundleFiles(scratch),
      committed: readBundleFiles(ROOT),
    })
    process.stdout.write(ok ? `${message}\n` : '')
    process.stderr.write(ok ? '' : `${message}\n`)
    process.exitCode = ok ? 0 : 1
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
