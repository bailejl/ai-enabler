import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The folders the build writes. The build config is the only place that says which artifacts
// exist, so both sides are read by walking these folders, with no file list to drift.
const BUNDLE_DIRS = ['plugin/server', 'plugin/schema']

// Every file under the bundle folders of `base`, keyed by repo path with forward slashes. A missing
// folder has no files.
export const readBundleFiles = (base) =>
  Object.fromEntries(
    BUNDLE_DIRS.flatMap((dir) => {
      try {
        return readdirSync(path.join(base, dir), { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => path.relative(base, path.join(entry.parentPath, entry.name)))
          .map((name) => [name.split(path.sep).join('/'), readFileSync(path.join(base, name))])
      } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
      }
    }),
  )
