import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { createDiagnostics } from '../e2e/diagnostics-api.js'
import { FIXTURE_FILE, filesImportingTest } from './e2e-imports.js'

const E2E_DIR = new URL('../e2e/', import.meta.url)

const file = (text, name = 'a.spec.js') => ({ name, text })
const offenders = (text, name) => filesImportingTest([file(text, name)])

describe('filesImportingTest', () => {
  test.each([
    ["import { test } from '@playwright/test'", 'a static import of test'],
    ["import { test, expect } from '@playwright/test'", 'test beside expect'],
    ["import { expect, test } from '@playwright/test'", 'test after expect'],
    ["import { test as base } from '@playwright/test'", 'test under another name'],
    ["import { expect, test as base } from '@playwright/test'", 'test renamed beside expect'],
    ['import {\n  expect,\n  test,\n} from "@playwright/test"', 'a multi-line import'],
    ["import pw, { test } from '@playwright/test'", 'a default import beside test'],
    ["export { test } from '@playwright/test'", 're-exporting test'],
    ["export { test as it } from '@playwright/test'", 're-exporting test under another name'],
    ["const { test } = await import('@playwright/test')", 'a dynamic import'],
    ['const pw = await import("@playwright/test")', 'a dynamic import with double quotes'],
    ['const pw = await import(`@playwright/test`)', 'a dynamic import with backticks'],
    ["import test from '@playwright/test'", 'a default import'],
    ["import test, { expect } from '@playwright/test'", 'a default import beside expect'],
    ["import { default as test } from '@playwright/test'", 'default imported as test'],
    ["export { default as test } from '@playwright/test'", 'default re-exported as test'],
    ["export { default } from '@playwright/test'", 're-exporting the default'],
    ["import * as pw from '@playwright/test'", 'a namespace import'],
    ["export * from '@playwright/test'", 'export star'],
    ["export * as pw from '@playwright/test'", 'export star as a namespace'],
    ["import { type test } from '@playwright/test'", 'test with a type modifier'],
    ["import { test } from 'playwright/test'", 'test from the playwright package'],
    [
      'import { expect } from "@playwright/test"\nimport { test } from "@playwright/test"',
      'two imports',
    ],
  ])('reports %s (%s)', (text) => {
    expect(offenders(text)).toEqual(['a.spec.js'])
  })

  test.each([
    ["import { expect } from '@playwright/test'", 'only expect'],
    ["import { expect, devices } from '@playwright/test'", 'expect and another helper'],
    ["import { defineConfig } from '@playwright/test'", 'defineConfig'],
    ["import { testInfo } from '@playwright/test'", 'a name that starts with test'],
    ["import { test } from './fixtures.js'", 'test from the shared fixture'],
    ["import { test } from '@playwright/test-extra'", 'test from another package'],
    ["import { contest as test2 } from '@playwright/test'", 'a name that ends with test'],
    ["export const a = 1\nimport { expect } from '@playwright/test'", 'an export before expect'],
    [
      "import { a } from './a.js'\nimport { expect } from '@playwright/test'",
      'an unrelated import',
    ],
    [
      "import { expect } from '@playwright/test'\nexport default test",
      'a default export of a local',
    ],
  ])('does not report %s (%s)', (text) => {
    expect(offenders(text)).toEqual([])
  })

  test('exempts the fixture file', () => {
    expect(offenders("import { test as base } from '@playwright/test'", FIXTURE_FILE)).toEqual([])
  })

  test('names every offending file, in the order given', () => {
    const files = [
      file("import { test } from '@playwright/test'", 'one.spec.js'),
      file("import { expect } from '@playwright/test'", 'two.js'),
      file("await import('@playwright/test')", 'three.js'),
    ]

    expect(filesImportingTest(files)).toEqual(['one.spec.js', 'three.js'])
  })
})

describe('the e2e folder (AC10)', () => {
  const e2eFiles = readdirSync(E2E_DIR, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ name, text: readFileSync(new URL(name, E2E_DIR), 'utf8') }))

  test('has e2e files to check', () => {
    expect(e2eFiles.map(({ name }) => name)).toContain(FIXTURE_FILE)
  })

  test('has no file but the fixture importing test from @playwright/test', () => {
    expect(filesImportingTest(e2eFiles)).toEqual([])
  })

  test('has every spec importing test from ./fixtures.js (AC12)', () => {
    const specs = e2eFiles.filter(({ name }) => name.endsWith('.spec.js'))

    expect(specs.length).toBeGreaterThan(0)
    for (const { name, text } of specs) {
      expect(text, name).toMatch(
        /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]\.\/fixtures\.js['"]/,
      )
    }
  })

  test('has the fixture importing test, so the check is not vacuous', () => {
    const fixture = e2eFiles.find(({ name }) => name === FIXTURE_FILE)

    expect(fixture.text).toMatch(/\btest as base\b/)
  })
})

describe('the fixture gate code (AC11)', () => {
  test('gives tests a diagnostics object with exactly one key, expect', () => {
    expect(Object.keys(createDiagnostics([]))).toEqual(['expect'])
  })

  test('records the codes a test declares, across calls', () => {
    const expected = []
    const diagnostics = createDiagnostics(expected)

    diagnostics.expect(['A_CODE'])
    diagnostics.expect(['B_CODE', 'C_CODE'])

    expect(expected).toEqual(['A_CODE', 'B_CODE', 'C_CODE'])
  })

  test.each([FIXTURE_FILE, 'diagnostics-api.js'])(
    'keeps e2e/%s free of environment reads and the file system',
    (name) => {
      const text = readFileSync(new URL(name, E2E_DIR), 'utf8')

      expect(text).not.toContain('import.meta.env')
      expect(text).not.toMatch(/['"](node:)?fs(\/promises)?['"]/)
      expect(text).not.toContain('process.env')
    },
  )
})
