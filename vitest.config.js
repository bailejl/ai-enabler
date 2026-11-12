import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        include: ['src/**/*.{js,jsx}', 'scripts/**/*.js'],
        exclude: [
          'src/**/*.test.{js,jsx}',
          'src/main.jsx',
          'src/App.jsx',
          'scripts/**/*.test.js',
          // CLI wrappers are thin stdin/exit shells covered by spawn tests
          'scripts/**/*-cli.js',
        ],
      },
    },
  }),
)
