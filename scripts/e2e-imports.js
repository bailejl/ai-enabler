// Finds the e2e files that take Playwright's `test` straight from `@playwright/test` instead of the
// shared fixture, which would leave their tests outside the diagnostics gate. Importing `expect`
// or any other helper from Playwright stays allowed.

export const FIXTURE_FILE = 'fixtures.js'

const PLAYWRIGHT = String.raw`['"]@playwright/test['"]`
// `import { a, b as c } from '@playwright/test'` or the same with `export`, over any lines.
const NAMED_FROM_PLAYWRIGHT = new RegExp(
  String.raw`\b(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*${PLAYWRIGHT}`,
  'g',
)
const DYNAMIC_PLAYWRIGHT = new RegExp(String.raw`\bimport\s*\(\s*${PLAYWRIGHT}\s*\)`)

const importedName = (specifier) => specifier.trim().split(/\s+as\s+/)[0]

const importsTestStatically = (text) =>
  [...text.matchAll(NAMED_FROM_PLAYWRIGHT)].some(([, specifiers]) =>
    specifiers.split(',').some((specifier) => importedName(specifier) === 'test'),
  )

const importsTest = (text) => importsTestStatically(text) || DYNAMIC_PLAYWRIGHT.test(text)

/**
 * The names of the files whose text imports `test` from `@playwright/test`, statically (including
 * `test as x`) or through `import()`. `files` are `{ name, text }`; the fixture file is exempt.
 */
export const filesImportingTest = (files) =>
  files
    .filter(({ name, text }) => name !== FIXTURE_FILE && importsTest(text))
    .map(({ name }) => name)
