import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PORT lets parallel git worktrees run their own dev server.
const port = Number(process.env.PORT) || 3000

export default defineConfig({
  plugins: [react()],
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
})
