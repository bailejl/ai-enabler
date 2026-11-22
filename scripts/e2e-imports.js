// Finds the e2e files that take Playwright's `test` straight from `@playwright/test` instead of the
// shared fixture, which would leave their tests outside the diagnostics gate. Importing `expect`
// or any other named helper from Playwright stays allowed. Forms that expose `test` without naming
// it are always reported: a default import (Playwright's default export is `test`), a namespace
// import or `export *`, and any `import()` of the module.

export const FIXTURE_FILE = 'fixtures.js'

// `@playwright/test` and `playwright/test` export the same `test`; any quote style.
const PLAYWRIGHT = String.raw`['"\`](?:@playwright|playwright)/test['"\`]`
const IDENTIFIER = String.raw`[\w$]+`
const NAMESPACE = String.raw`\*(?:\s+as\s+${IDENTIFIER})?`
const BRACES = String.raw`\{[^}]*\}`
// What sits between `import` or `export` and `from`: a namespace, a default binding with an
// optional namespace or braces after it, or braces alone.
const CLAUSE = String.raw`(${NAMESPACE}|${IDENTIFIER}(?:\s*,\s*(?:${NAMESPACE}|${BRACES}))?|${BRACES})`
const FROM_PLAYWRIGHT = new RegExp(
  String.raw`\b(?:import|export)\s+(?:type\s+)?${CLAUSE}\s*from\s*${PLAYWRIGHT}`,
  'g',
)
const DYNAMIC_PLAYWRIGHT = new RegExp(String.raw`\bimport\s*\(\s*${PLAYWRIGHT}\s*\)`)

const TEST_NAMES = Object.freeze(['test', 'default'])

const importedName = (specifier) =>
  specifier
    .trim()
    .replace(/^type\s+/, '')
    .split(/\s+as\s+/)[0]

const bracedNames = (clause) => {
  const open = clause.indexOf('{')
  return open === -1 ? [] : clause.slice(open + 1, clause.lastIndexOf('}')).split(',')
}

const clauseExposesTest = (clause) =>
  clause.startsWith('*') ||
  /^[\w$]/.test(clause) ||
  bracedNames(clause).some((specifier) => TEST_NAMES.includes(importedName(specifier)))

const importsTestStatically = (text) =>
  [...text.matchAll(FROM_PLAYWRIGHT)].some(([, clause]) => clauseExposesTest(clause))

const importsTest = (text) => importsTestStatically(text) || DYNAMIC_PLAYWRIGHT.test(text)

/**
 * The names of the files whose text takes `test` from Playwright: a static import or re-export of
 * `test` (including `test as x`), a default import, a namespace import, `export *`, or `import()`.
 * `files` are `{ name, text }`; the fixture file is exempt.
 */
export const filesImportingTest = (files) =>
  files
    .filter(({ name, text }) => name !== FIXTURE_FILE && importsTest(text))
    .map(({ name }) => name)
