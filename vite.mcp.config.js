import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { GUIDES_FOLDER, readGuides } from './src/flow/diagnostics/readGuides.js'

const SCHEMA_SOURCE = 'public/schema/project-0.1.0.json'
const GUIDE_SOURCE = fileURLToPath(new URL('./mcp/guideSource.js', import.meta.url))

// Copies the JSON Schema next to the server folder, so `plugin/schema/` and `plugin/server/` stay
// a pair wherever the build writes them. The schema folder is emptied first, so a schema from an
// older version cannot linger.
const copySchema = () => ({
  name: 'aie-copy-schema',
  writeBundle: ({ dir }) => {
    const folder = path.resolve(dir, '..', 'schema')
    rmSync(folder, { recursive: true, force: true })
    mkdirSync(folder, { recursive: true })
    copyFileSync(SCHEMA_SOURCE, path.join(folder, path.basename(SCHEMA_SOURCE)))
  },
})

// Replaces `mcp/guideSource.js` with a module holding the same guides as JSON, read once here, so the
// bundle carries every guide and needs no guides folder at run time. The guides are sorted by code,
// so the key order is the same on every OS; `.gitattributes` keeps their line endings the same too.
// A build in which the swap never ran fails, instead of bundling a server that reads a folder it
// does not have.
const bundleGuides = () => {
  let hasSwapped = false
  return {
    name: 'aie-bundle-guides',
    load: (id) => {
      if (path.resolve(id.split('?')[0]) !== GUIDE_SOURCE) return null
      hasSwapped = true
      return `export const GUIDES = ${JSON.stringify(readGuides(GUIDES_FOLDER))}`
    },
    buildEnd: () => {
      if (!hasSwapped)
        throw new Error(`The guides were not bundled: ${GUIDE_SOURCE} was never loaded`)
    },
  }
}

// Bundles the MCP server and every dependency into one self-contained Node file, so the plugin
// needs no `npm install`. Output is deterministic: one chunk, no sourcemap, no timestamp.
export default defineConfig({
  configFile: false,
  publicDir: false,
  plugins: [bundleGuides(), copySchema()],
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'mcp/server.js',
    target: 'node24',
    outDir: 'plugin/server',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    copyPublicDir: false,
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'aie-mcp.js', codeSplitting: false },
    },
  },
})
