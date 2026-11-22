import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const SCHEMA = 'public/schema/project-0.1.0.json'

// Copies the JSON Schema next to the server folder, so `plugin/schema/` and `plugin/server/` stay
// a pair wherever the build writes them.
const copySchema = () => ({
  name: 'aie-copy-schema',
  writeBundle: ({ dir }) => {
    const target = path.resolve(dir, '..', 'schema', path.basename(SCHEMA))
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(SCHEMA, target)
  },
})

// Bundles the MCP server and every dependency into one self-contained Node file, so the plugin
// needs no `npm install`. Output is deterministic: one chunk, no sourcemap, no timestamp.
export default defineConfig({
  configFile: false,
  publicDir: false,
  plugins: [copySchema()],
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
