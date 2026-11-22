// stryker.config.mjs
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  mutate: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/**/testHelpers.js',
    '!src/flow/diagnostics/gate-selftest/**',
    '!src/main.jsx',
    '!src/App.jsx',
    'scripts/**/*.js',
    '!scripts/**/*.test.js',
    // CLI wrappers are thin stdin/exit shells covered by spawn tests
    '!scripts/**/*-cli.js',
    'mcp/**/*.js',
    '!mcp/**/*.test.js',
    // The server is a thin stdio shell over the tested tools; it has no logic of its own
    '!mcp/server.js',
    '!plugin/server/**',
  ],
}
