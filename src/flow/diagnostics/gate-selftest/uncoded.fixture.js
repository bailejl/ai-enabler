// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
import { it } from 'vitest'

it('fails on an uncoded console.error', () => {
  console.error('something broke')
})

it('fails on an uncoded console.warn', () => {
  console.warn('something broke')
})
