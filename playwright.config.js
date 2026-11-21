import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import { e2ePorts } from './scripts/e2e-ports.js'
import { PAGES_BASE } from './scripts/pages-base.js'

// Ports derive from this checkout's path, so parallel git worktrees never share a server.
const { port, previewPort, reuseDevServer } = e2ePorts({
  env: process.env,
  root: fileURLToPath(new URL('.', import.meta.url)),
})
const baseURL = `http://localhost:${port}`
// The production build is previewed on its own port, under the GitHub Pages base path.
const previewURL = `http://localhost:${previewPort}`
const PAGES_SPEC = 'pages.spec.js'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    reducedMotion: 'reduce',
    baseURL,
  },
  webServer: [
    {
      command: 'npm run dev',
      url: baseURL,
      env: { PORT: String(port) },
      reuseExistingServer: reuseDevServer,
    },
    {
      command: 'npm run build && npm run preview',
      url: `${previewURL}${PAGES_BASE}`,
      env: { PORT: String(previewPort) },
      // Never reuse: a running preview may serve a stale build.
      reuseExistingServer: false,
      // The command runs a full production build before serving.
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: PAGES_SPEC,
      use: { browserName: 'chromium' },
    },
    {
      name: 'pages',
      testMatch: PAGES_SPEC,
      use: { browserName: 'chromium', baseURL: previewURL },
    },
  ],
})
