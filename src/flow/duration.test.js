import { describe, it, expect } from 'vitest'
import { formatDuration } from './duration.js'

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [45, '45m'],
    [59, '59m'],
    [60, '1h'],
    [260, '4h 20m'],
    [479, '7h 59m'],
    [480, '1d'],
    [481, '1d'],
    [600, '1d 2h'],
    [959, '1d 7h'],
    [5840, '12d 1h'],
  ])('formats %i minutes as "%s" (two largest working-day units)', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })
})
