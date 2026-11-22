import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteBase } from './scripts/pages-base.js'

// PORT lets parallel git worktrees run their own dev server.
const port = Number(process.env.PORT) || 3000

// Only the version is injected, so the rest of package.json stays out of the bundle.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig((env) => ({
  base: viteBase(env),
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
}))
