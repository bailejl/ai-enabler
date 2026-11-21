import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { PAGES_BASE } from './pages-base.js'

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const LIVE_URL = `https://bailejl.github.io${PAGES_BASE}`

test(`the README links the live site at ${LIVE_URL}`, () => {
  expect(README).toContain(`<${LIVE_URL}>`)
})
