import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { versionSection } from './changelog.js'

const CHANGELOG = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const headings = CHANGELOG.split('\n').filter((line) => line.startsWith('## '))
const listItems = (section) => section.split('\n').filter((line) => line.startsWith('- '))

describe('CHANGELOG.md', () => {
  test('starts with the Changelog title', () => {
    expect(CHANGELOG.startsWith('# Changelog')).toBe(true)
  })

  test('has Unreleased followed by the current version with an ISO date', () => {
    expect(headings[0]).toBe('## [Unreleased]')
    expect(headings[1]).toMatch(new RegExp(`^## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}$`))
  })

  test.each(['Pages', 'MCP', 'diagnostics'])(
    'the current version section has a list item mentioning %s',
    (topic) => {
      const items = listItems(versionSection(CHANGELOG, version) ?? '')
      expect(items.some((item) => item.toLowerCase().includes(topic.toLowerCase()))).toBe(true)
    },
  )
})

describe('versionSection', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-11-22\n\n- First\n- Second\n'

  test('returns the body of the named section', () => {
    expect(versionSection(text, '0.1.0')).toBe('\n- First\n- Second\n')
  })

  test('stops at the next section heading', () => {
    expect(versionSection(text, 'Unreleased')).toBe('')
  })

  test('returns null for a version with no section', () => {
    expect(versionSection(text, '0.2.0')).toBeNull()
  })
})
