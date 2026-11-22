// Runs only e2e/gate-wiring.selftest.js, whose tests fail on purpose to prove the e2e gate fails a
// test. e2e/gate.spec.js runs this config in a child process and reads its JSON report, so a
// failure caused by anything but the gate cannot pass for one. It starts no server: the parent run
// hands over the address of the one it already has in GATE_SELFTEST_BASE_URL.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'gate-wiring.selftest.js',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    reducedMotion: 'reduce',
    baseURL: process.env.GATE_SELFTEST_BASE_URL,
    browserName: 'chromium',
  },
})
