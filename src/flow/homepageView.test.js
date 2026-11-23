import { describe, expect, it } from 'vitest'
import { projectHref, toCardItems } from './homepageView.js'

describe('toCardItems', () => {
  const entries = [
    { id: 'b', name: 'B', modifiedAt: '2026-11-22T10:00:00.000Z' },
    { id: 'a', name: 'A', modifiedAt: '2026-11-21T09:00:00.000Z' },
  ]

  it('gives each entry its name, date text in the zone, ISO time and link, in the given order', () => {
    expect(toCardItems(entries, { timeZone: 'UTC' })).toEqual([
      {
        id: 'b',
        name: 'B',
        modifiedAt: '2026-11-22T10:00:00.000Z',
        modifiedText: '22 Nov 2026, 10:00',
        href: '#/projects/b',
      },
      {
        id: 'a',
        name: 'A',
        modifiedAt: '2026-11-21T09:00:00.000Z',
        modifiedText: '21 Nov 2026, 09:00',
        href: '#/projects/a',
      },
    ])
  })

  it('shows the time in the zone it is given', () => {
    const [item] = toCardItems(entries, { timeZone: 'Asia/Tokyo' })
    expect(item.modifiedText).toBe('22 Nov 2026, 19:00')
  })

  it('shows a time that does not parse as stored', () => {
    const [item] = toCardItems([{ id: 'a', name: 'A', modifiedAt: 'not a time' }], {
      timeZone: 'UTC',
    })
    expect(item.modifiedText).toBe('not a time')
  })

  it('lists nothing for no entries', () => {
    expect(toCardItems([], { timeZone: 'UTC' })).toEqual([])
  })
})

describe('projectHref', () => {
  it('encodes the id as one path segment', () => {
    expect(projectHref('a/b c')).toBe('#/projects/a%2Fb%20c')
  })
})
