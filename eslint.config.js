import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

const CLASS_EXPRESSION_SELECTOR = {
  selector: 'ClassExpression',
  message: 'Use functions and closures instead of classes.',
}

const MCP_IMPORT_PATTERN = {
  group: ['**/mcp', '**/mcp/**'],
  message: 'src/ must not import from mcp/.',
}

const PACKAGE_JSON_IMPORT_PATTERN = {
  regex: '(^|/)package\\.json$',
  message: 'Read the app version from src/shell/version.js, not from package.json.',
}

// The only src files that may call console: the sink, the test helpers, tests and the gate
// self-test fixtures.
const CONSOLE_ALLOWED_FILES = [
  'src/shell/diagnostics.js',
  'src/testHelpers.js',
  'src/**/*.test.{js,jsx}',
  'src/flow/diagnostics/gate-selftest/*.fixture.js',
]

const TEST_FILES = ['src/**/*.test.{js,jsx}']

export default [
  js.configs.recommended,
  prettier,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Functional style: no classes
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'Use functions and closures instead of classes.',
        },
        CLASS_EXPRESSION_SELECTOR,
        {
          selector: 'ThisExpression',
          message: 'Avoid "this" — use closures and explicit parameters instead.',
        },
      ],

      // Immutability
      'prefer-const': 'error',
      'no-var': 'error',
      'no-param-reassign': 'error',

      // Clean code
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
    },
  },
  {
    // mcp/ may use the pure flow logic and nothing else from src/ (React, the app shell)
    files: ['mcp/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)src/(?!flow/)',
              message: 'mcp/ may import from src/flow/ only.',
            },
          ],
        },
      ],
    },
  },
  {
    // the app never depends on the MCP server, only the diagnostics sink writes to the console, and
    // only version.js knows where the app version comes from
    files: ['src/**/*.{js,jsx}'],
    ignores: TEST_FILES,
    rules: {
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        { patterns: [MCP_IMPORT_PATTERN, PACKAGE_JSON_IMPORT_PATTERN] },
      ],
    },
  },
  {
    // tests may read package.json, but never import mcp/
    files: TEST_FILES,
    rules: {
      'no-restricted-imports': ['error', { patterns: [MCP_IMPORT_PATTERN] }],
    },
  },
  {
    files: CONSOLE_ALLOWED_FILES,
    rules: { 'no-console': 'off' },
  },
  {
    // React error boundaries must be class components: this file may declare a class and use this,
    // but still not write a class expression
    files: ['src/shell/ErrorBoundary.jsx'],
    rules: { 'no-restricted-syntax': ['error', CLASS_EXPRESSION_SELECTOR] },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'reports/',
      '.stryker-tmp/',
      'test-results/',
      'playwright-report/',
      'graphify-out/',
    ],
  },
]
