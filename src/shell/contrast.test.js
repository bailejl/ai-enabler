import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast.js'
import { toCssCustomProperties, tokens } from './tokens.js'

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#ffffff', 21],
    ['#ffffff', '#000000', 21],
    ['#ffffff', '#ffffff', 1],
  ])('%s on %s is exactly %d', (a, b, expected) => {
    expect(contrastRatio(a, b)).toBe(expected)
  })

  it('computes #777777 on white as about 4.48', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('accepts uppercase hex', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21)
  })

  it.each(['#fff', 'ffffff', '#gggggg', '', 'red'])('rejects %j as not a #rrggbb color', (bad) => {
    expect(() => contrastRatio(bad, '#ffffff')).toThrow(/#rrggbb/)
  })
})

// Token pairs that must meet a minimum contrast. Later slices append rows.
const TEXT_MINIMUM = 4.5
const NON_TEXT_MINIMUM = 3
const contrastPairs = [
  ['headerText', 'headerBackground', TEXT_MINIMUM],
  ['focusRing', 'headerBackground', NON_TEXT_MINIMUM],
  ['focusRing', 'pageBackground', NON_TEXT_MINIMUM],
  ['focusRing', 'menuBackground', NON_TEXT_MINIMUM],
  ['focusRing', 'cardBackground', NON_TEXT_MINIMUM],
  ['menuText', 'menuBackground', TEXT_MINIMUM],
  ['tileText', 'statusOnTargetBackground', TEXT_MINIMUM],
  ['tileText', 'statusWatchBackground', TEXT_MINIMUM],
  ['tileText', 'statusNeedsAttentionBackground', TEXT_MINIMUM],
  ['tileText', 'statusNoneBackground', TEXT_MINIMUM],
  ['tileBorder', 'pageBackground', NON_TEXT_MINIMUM],
  ['cardText', 'cardBackground', TEXT_MINIMUM],
  ['queueBadgeText', 'queueBadgeBackground', TEXT_MINIMUM],
  ['batchBadgeText', 'batchBadgeBackground', TEXT_MINIMUM],
  ['queueBadgeBorder', 'pageBackground', NON_TEXT_MINIMUM],
  ['batchBadgeBorder', 'pageBackground', NON_TEXT_MINIMUM],
  ['edgeStroke', 'pageBackground', NON_TEXT_MINIMUM],
  ['arrowhead', 'pageBackground', NON_TEXT_MINIMUM],
  ['handleDot', 'pageBackground', NON_TEXT_MINIMUM],
]

describe('theme token contrast', () => {
  it.each(contrastPairs)('%s on %s is at least %d:1', (foreground, background, minimum) => {
    expect(contrastRatio(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(minimum)
  })

  it('keeps the card border subdued, below 3:1 on the card surface (decorative, AC11)', () => {
    expect(contrastRatio(tokens.cardBorder, tokens.cardBackground)).toBeLessThan(NON_TEXT_MINIMUM)
  })

  it('has a token for every name in the pair table', () => {
    const names = contrastPairs.flatMap(([foreground, background]) => [foreground, background])
    expect(names.filter((name) => !(name in tokens))).toEqual([])
  })
})

describe('toCssCustomProperties', () => {
  it('maps camelCase token names to kebab-case custom properties', () => {
    expect(toCssCustomProperties({ headerBackground: '#000000', focusRing: '#111111' })).toEqual({
      '--header-background': '#000000',
      '--focus-ring': '#111111',
    })
  })

  it('maps every token', () => {
    expect(Object.keys(toCssCustomProperties(tokens))).toHaveLength(Object.keys(tokens).length)
  })
})
