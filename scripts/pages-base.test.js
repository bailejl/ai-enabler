import { describe, expect, test } from 'vitest'
import { PAGES_BASE, viteBase } from './pages-base.js'

describe('viteBase', () => {
  test('the Pages base is the repository path', () => {
    expect(PAGES_BASE).toBe('/ai-enabler/')
  })

  test.each([
    [{ command: 'build', isPreview: false }, '/ai-enabler/'],
    [{ command: 'build' }, '/ai-enabler/'],
    [{ command: 'serve', isPreview: true }, '/ai-enabler/'],
    [{ command: 'serve', isPreview: false }, '/'],
    [{ command: 'serve', mode: 'test' }, '/'],
  ])('%j resolves to %j', (env, base) => {
    expect(viteBase(env)).toBe(base)
  })
})
