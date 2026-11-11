import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Functional style: no classes
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'Use functions and closures instead of classes.',
        },
        {
          selector: 'ClassExpression',
          message: 'Use functions and closures instead of classes.',
        },
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
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/'],
  },
]
