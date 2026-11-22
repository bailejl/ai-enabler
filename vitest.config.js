import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.js', 'mcp/**/*.test.js'],
      // The diagnostics gate: fails a test on uncoded console output, unexpected or unknown codes,
      // and declared codes that were never written
      setupFiles: ['./vitest.setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        include: ['src/**/*.{js,jsx}', 'scripts/**/*.js', 'mcp/**/*.js'],
        exclude: [
          'src/**/*.test.{js,jsx}',
          // Test-only helpers shared by colocated tests
          'src/**/testHelpers.js',
          'src/main.jsx',
          // Dev-only crash trigger; e2e/crash.spec.js covers it, like main.jsx
          'src/shell/DevCrashTrigger.jsx',
          'src/App.jsx',
          // The gate's wiring and the fixtures that test it
          'vitest.setup.js',
          'vitest.selftest.config.js',
          'src/flow/diagnostics/gate-selftest/**',
          'scripts/**/*.test.js',
          // CLI wrappers are thin stdin/exit shells covered by spawn tests
          'scripts/**/*-cli.js',
          'mcp/**/*.test.js',
          // The server is a thin stdio shell over the tested tools; it has no logic of its own
          'mcp/server.js',
          // Generated bundle of mcp/server.js and its dependencies
          'plugin/server/**',
        ],
      },
    },
  }),
)
