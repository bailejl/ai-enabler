import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { ESLint } from 'eslint'
import config from '../eslint.config.js'

const ROOT = new URL('..', import.meta.url)
const SRC_DIR = new URL('src/', ROOT)
const eslint = new ESLint({ cwd: ROOT.pathname })

// Lints `code` as if it lived at `filePath` (a path under the repo root that need not exist) and
// returns the rule ids reported, in order.
const reportedRules = async (code, filePath) => {
  const [{ messages }] = await eslint.lintText(code, { filePath: `${ROOT.pathname}${filePath}` })
  return messages.map(({ ruleId }) => ruleId)
}

const CONSOLE_CALLS = ["console.log('x')", "console.error('x')"]
const CLASS_DECLARATION_WITH_THIS = 'export class A { read() { return this } }'
const CLASS_EXPRESSION = 'export const A = class {}'
const THIS_IN_FUNCTION = 'export function read() { return this }'
const PACKAGE_JSON_IMPORT =
  "import pkg from '../../package.json' with { type: 'json' }\nexport default pkg"

describe('no-console (AC16)', () => {
  test.each(CONSOLE_CALLS)('%s in a src file reports no-console as an error', async (call) => {
    const [{ messages }] = await eslint.lintText(call, {
      filePath: `${ROOT.pathname}src/shell/Other.js`,
    })
    expect(messages.map(({ ruleId, severity }) => [ruleId, severity])).toEqual([['no-console', 2]])
  })

  test.each([
    'src/shell/diagnostics.js',
    'src/testHelpers.js',
    'src/shell/Other.test.js',
    'src/shell/Other.test.jsx',
    'src/flow/diagnostics/gate-selftest/other.fixture.js',
  ])('a console call in %s reports nothing', async (filePath) => {
    expect(await reportedRules(CONSOLE_CALLS.join('\n'), filePath)).toEqual([])
  })

  test('a console call outside src stays a warning, not an error', async () => {
    const [{ messages }] = await eslint.lintText("console.log('x')", {
      filePath: `${ROOT.pathname}scripts/other.js`,
    })
    expect(messages.map(({ ruleId, severity }) => [ruleId, severity])).toEqual([['no-console', 1]])
  })
})

describe('class rule (AC17)', () => {
  test('a class declaration using this in ErrorBoundary.jsx reports nothing', async () => {
    expect(await reportedRules(CLASS_DECLARATION_WITH_THIS, 'src/shell/ErrorBoundary.jsx')).toEqual(
      [],
    )
  })

  test('a class expression in ErrorBoundary.jsx reports no-restricted-syntax', async () => {
    expect(await reportedRules(CLASS_EXPRESSION, 'src/shell/ErrorBoundary.jsx')).toEqual([
      'no-restricted-syntax',
    ])
  })

  test.each(['src/shell/Other.jsx', 'src/shell/Other.test.jsx'])(
    'a class declaration in %s reports no-restricted-syntax',
    async (filePath) => {
      expect(await reportedRules('export class A {}', filePath)).toEqual(['no-restricted-syntax'])
    },
  )

  test.each(['src/shell/Other.jsx', 'src/shell/Other.test.jsx'])(
    'this in %s reports no-restricted-syntax',
    async (filePath) => {
      expect(await reportedRules(THIS_IN_FUNCTION, filePath)).toEqual(['no-restricted-syntax'])
    },
  )

  test('exactly one config entry names ErrorBoundary.jsx', () => {
    const naming = config.filter(({ files }) =>
      (files ?? []).flat().some((pattern) => pattern.includes('ErrorBoundary.jsx')),
    )
    expect(naming).toHaveLength(1)
  })
})

describe('app version (AC14)', () => {
  test('a package.json import in a non-test src file is an error', async () => {
    expect(await reportedRules(PACKAGE_JSON_IMPORT, 'src/shell/Other.js')).toEqual([
      'no-restricted-imports',
    ])
  })

  test('a package.json import in a src test file reports nothing', async () => {
    expect(await reportedRules(PACKAGE_JSON_IMPORT, 'src/shell/Other.test.js')).toEqual([])
  })

  test('only src/shell/version.js among non-test src files contains __APP_VERSION__', () => {
    const holders = readdirSync(SRC_DIR, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && !/\.test\.[jt]sx?$/.test(entry.name))
      .map((entry) => `${entry.parentPath}/${entry.name}`)
      .filter((path) => readFileSync(path, 'utf8').includes('__APP_VERSION__'))
      .map((path) => path.slice(SRC_DIR.pathname.length))
    expect(holders).toEqual(['shell/version.js'])
  })
})
