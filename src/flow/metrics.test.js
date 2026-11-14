import { describe, expect, it } from 'vitest'
import { initialNodes } from './initialFlow.js'
import { computeMetrics, metricTiles, rateMetric } from './metrics.js'

const stepsOf = (nodes) => nodes.map((node) => node.data)
const tileByKey = (steps, key) => metricTiles(steps).find((tile) => tile.key === key)

describe('metricTiles', () => {
  it('produces the spec tiles for the starter steps, in order', () => {
    const tiles = metricTiles(stepsOf(initialNodes)).map(({ label, text, statusLabel }) => ({
      label,
      text,
      statusLabel,
    }))

    expect(tiles).toEqual([
      { label: 'Total lead time', text: '12d 4h', statusLabel: null },
      { label: 'Total process time', text: '3d 2h', statusLabel: null },
      { label: 'Flow efficiency', text: '26.0%', statusLabel: 'Watch' },
      { label: 'First pass yield', text: '53.1%', statusLabel: 'Watch' },
      { label: 'Total queue', text: '34', statusLabel: 'Watch' },
      { label: 'Avg process time', text: '4h 20m', statusLabel: null },
      { label: 'Steps', text: '6', statusLabel: null },
    ])
  })

  it('exposes stable keys and status values', () => {
    const tiles = metricTiles(stepsOf(initialNodes))

    expect(tiles.map(({ key }) => key)).toEqual([
      'totalLeadTime',
      'totalProcessTime',
      'flowEfficiency',
      'firstPassYield',
      'totalQueue',
      'avgProcessTime',
      'steps',
    ])
    expect(tiles[2]).toMatchObject({ status: 'watch', statusLabel: 'Watch' })
    expect(tiles[0]).toMatchObject({ status: null, statusLabel: null })
  })

  it('shows a dash with no status on every tile when there are no steps', () => {
    const tiles = metricTiles([])

    expect(tiles).toHaveLength(7)
    expect(tiles.map(({ text }) => text)).toEqual(Array(7).fill('—'))
    expect(tiles.map(({ status }) => status)).toEqual(Array(7).fill(null))
  })

  it('shows flow efficiency as a dash with no status when total lead time is 0', () => {
    const tile = tileByKey([{ label: 'A', pt: 60, ca: 90, queue: 1 }], 'flowEfficiency')

    expect(tile).toMatchObject({ text: '—', status: null, statusLabel: null })
  })

  it('rounds average process time to the nearest minute', () => {
    const steps = [{ pt: 20 }, { pt: 20 }, { pt: 10 }]

    expect(tileByKey(steps, 'avgProcessTime').text).toBe('17m')
  })

  it('rates and displays flow efficiency from the one-decimal value', () => {
    // 699.6 / 1000 = 69.96% -> displays 70.0% -> On target
    const tile = tileByKey([{ pt: 6996, lt: 10000 }], 'flowEfficiency')

    expect(tile).toMatchObject({ text: '70.0%', status: 'on-target' })
  })

  it('totals every step whatever the connections', () => {
    const steps = stepsOf([
      { data: { label: 'A', pt: 10, lt: 100, ca: 100, queue: 1 } },
      { data: { label: 'B', pt: 20, lt: 200, ca: 100, queue: 2 } },
      { data: { label: 'C', pt: 30, lt: 300, ca: 100, queue: 3 } },
      { data: { label: 'D (unconnected)', pt: 40, lt: 400, ca: 100, queue: 4 } },
    ])

    expect(computeMetrics(steps)).toMatchObject({
      totalLeadTime: 1000,
      totalProcessTime: 100,
      totalQueue: 10,
      steps: 4,
    })
  })
})

describe('computeMetrics', () => {
  it('counts a missing PT, LT, and queue as 0 and a missing %C&A as 100', () => {
    const metrics = computeMetrics([{ label: 'Bare' }, { pt: 60, lt: 120, ca: 50, queue: 2 }])

    expect(metrics).toMatchObject({
      totalProcessTime: 60,
      totalLeadTime: 120,
      totalQueue: 2,
      firstPassYield: 50,
      flowEfficiency: 50,
      avgProcessTime: 30,
      steps: 2,
    })
  })

  it('reports flow efficiency as null when total lead time is 0', () => {
    expect(computeMetrics([{ pt: 60 }]).flowEfficiency).toBeNull()
  })

  it('reports ratio metrics as null when there are no steps', () => {
    expect(computeMetrics([])).toMatchObject({
      flowEfficiency: null,
      firstPassYield: null,
      avgProcessTime: null,
      steps: 0,
    })
  })
})

describe('rateMetric', () => {
  it.each([
    ['flowEfficiency', 70, 'on-target'],
    ['flowEfficiency', 69.96, 'on-target'],
    ['flowEfficiency', 69.9, 'watch'],
    ['flowEfficiency', 45, 'watch'],
    ['flowEfficiency', 20, 'watch'],
    ['flowEfficiency', 19.96, 'watch'],
    ['flowEfficiency', 19.9, 'needs-attention'],
    ['firstPassYield', 70, 'on-target'],
    ['firstPassYield', 69.9, 'watch'],
    ['firstPassYield', 60, 'watch'],
    ['firstPassYield', 50, 'watch'],
    ['firstPassYield', 49.96, 'watch'],
    ['firstPassYield', 49.9, 'needs-attention'],
    ['totalQueue', 0, 'on-target'],
    ['totalQueue', 19, 'on-target'],
    ['totalQueue', 20, 'watch'],
    ['totalQueue', 35, 'watch'],
    ['totalQueue', 50, 'watch'],
    ['totalQueue', 51, 'needs-attention'],
    ['avgProcessTime', 260, null],
  ])('rates %s of %s as %s', (key, value, status) => {
    expect(rateMetric(key, value)).toBe(status)
  })

  it('gives no status when the value is null', () => {
    expect(rateMetric('flowEfficiency', null)).toBeNull()
  })
})
