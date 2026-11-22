// Runs only the gate's self-test fixtures, with the same setup as the real suite. Several of them
// fail on purpose; src/flow/diagnostics/gate.test.js runs this config and checks each outcome.
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      include: ['src/flow/diagnostics/gate-selftest/*.fixture.js'],
      setupFiles: ['./vitest.setup.js'],
      // Some fixture tests rely on the test before them, so keep the declared order
      sequence: { shuffle: false, concurrent: false },
    },
  }),
)
