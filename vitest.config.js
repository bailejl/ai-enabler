import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.js', 'mcp/**/*.test.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        include: ['src/**/*.{js,jsx}', 'scripts/**/*.js', 'mcp/**/*.js'],
        exclude: [
          'src/**/*.test.{js,jsx}',
          // Test-only helpers shared by colocated tests
          'src/**/testHelpers.js',
          'src/main.jsx',
          'src/App.jsx',
          'scripts/**/*.test.js',
          // CLI wrappers are thin stdin/exit shells covered by spawn tests
          'scripts/**/*-cli.js',
          'mcp/**/*.test.js',
          // The server is a thin stdio shell over the tested tools; it has no logic of its own
          'mcp/server.js',
        ],
      },
    },
  }),
)
