import { defineConfig } from '@playwright/test'
import { PAGES_BASE } from './scripts/pages-base.js'

// PORT keeps parallel git worktrees from reusing each other's dev server.
const port = Number(process.env.PORT) || 3000
const baseURL = `http://localhost:${port}`
// The production build is previewed on its own port, under the GitHub Pages base path.
const previewPort = Number(process.env.PREVIEW_PORT) || port + 1000
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
      reuseExistingServer: !process.env.CI,
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
