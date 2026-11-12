// stryker.config.mjs
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  mutate: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/main.jsx',
    '!src/App.jsx',
    'scripts/**/*.js',
    '!scripts/**/*.test.js',
    '!scripts/proto-push-guard-cli.js',
  ],
}
