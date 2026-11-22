import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const GUIDE_EXTENSION = '.md'

// A URL folder needs its trailing slash, as `new URL('../guides/', import.meta.url)` has.
const fileIn = (dir, fileName) =>
  dir instanceof URL ? new URL(fileName, dir) : join(dir, fileName)

/**
 * Reads every `.md` file in `dir` (a path or a folder URL) into `{ CODE: text }`, keyed by the
 * file name without its extension and sorted by code, so the result is the same on every OS.
 * A leaf module with Node built-ins only, so the MCP server and its bundle can use it and the
 * browser app never does.
 */
export const readGuides = (dir) => {
  const codes = readdirSync(dir)
    .filter((fileName) => fileName.endsWith(GUIDE_EXTENSION))
    .map((fileName) => basename(fileName, GUIDE_EXTENSION))
    .toSorted()
  return Object.fromEntries(
    codes.map((code) => [code, readFileSync(fileIn(dir, `${code}${GUIDE_EXTENSION}`), 'utf8')]),
  )
}
