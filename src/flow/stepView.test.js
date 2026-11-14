import { describe, expect, it } from 'vitest'
import { initialNodes } from './initialFlow.js'
import { stepView } from './stepView.js'

const baseStep = { label: 'Step', pt: 60, lt: 120, ca: 90 }
const rowText = (view, key) => view.rows.find((row) => row.key === key).text

describe('stepView badges', () => {
  it.each([
    {
      field: 'queue',
      value: 20,
      badge: 'queueBadge',
      shown: { text: 'Q 20', name: '20 items waiting' },
    },
    { field: 'queue', value: 0, badge: 'queueBadge', shown: null },
    { field: 'queue', value: undefined, badge: 'queueBadge', shown: null },
    { field: 'batch', value: 3, badge: 'batchBadge', shown: { text: 'B 3', name: 'Batch size 3' } },
    { field: 'batch', value: 0, badge: 'batchBadge', shown: null },
    { field: 'batch', value: undefined, badge: 'batchBadge', shown: null },
  ])('$field $value gives $badge $shown', ({ field, value, badge, shown }) => {
    expect(stepView({ ...baseStep, [field]: value })[badge]).toEqual(shown)
  })
})

describe('stepView %C&A', () => {
  it.each([
    { ca: 87.4, text: '87%' },
    { ca: 87.5, text: '88%' },
    { ca: 0, text: '0%' },
    { ca: 100, text: '100%' },
    { ca: undefined, text: '—' },
  ])('%C&A $ca shows $text', ({ ca, text }) => {
    expect(rowText(stepView({ ...baseStep, ca }), 'ca')).toBe(text)
  })
})

describe('stepView PT and LT', () => {
  it.each([
    { key: 'pt', text: '—' },
    { key: 'lt', text: '—' },
  ])('absent $key shows $text', ({ key, text }) => {
    expect(rowText(stepView({ ...baseStep, [key]: undefined }), key)).toBe(text)
  })

  it('a zero duration shows 0m, not a dash', () => {
    expect(rowText(stepView({ ...baseStep, pt: 0 }), 'pt')).toBe('0m')
  })
})

describe('stepView of the Build starter step', () => {
  const build = stepView(initialNodes.find((node) => node.id === 'build').data)

  it('shows the title and the three values', () => {
    expect([build.title, rowText(build, 'pt'), rowText(build, 'lt'), rowText(build, 'ca')]).toEqual(
      ['Build', '1d', '2d 4h', '90%'],
    )
  })

  it('speaks each row by its expanded name', () => {
    expect(build.rows.map(({ abbreviation, spokenName }) => [abbreviation, spokenName])).toEqual([
      ['PT', 'process time'],
      ['LT', 'lead time'],
      ['%C&A', 'percent complete and accurate'],
    ])
  })
})
