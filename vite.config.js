import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteBase } from './scripts/pages-base.js'

// PORT lets parallel git worktrees run their own dev server.
const port = Number(process.env.PORT) || 3000

export default defineConfig((env) => ({
  base: viteBase(env),
  plugins: [react()],
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
}))
