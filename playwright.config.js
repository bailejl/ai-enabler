import { defineConfig } from '@playwright/test'

// PORT keeps parallel git worktrees from reusing each other's dev server.
const port = Number(process.env.PORT) || 3000
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    baseURL,
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
