import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { layoutSteps, STEP_CARD_HEIGHT, STEP_CARD_WIDTH } from './layout.js'

const step = (id) => ({ id, type: 'step', position: { x: 0, y: 0 }, data: { label: id } })
const edge = (source, target) => ({ id: `${source}->${target}`, source, target })
const ROOT_FONT_SIZE_PX = 16
const at = (laidOut, id) => laidOut.find((n) => n.id === id).position

const overlaps = (a, b) =>
  a.x < b.x + STEP_CARD_WIDTH &&
  b.x < a.x + STEP_CARD_WIDTH &&
  a.y < b.y + STEP_CARD_HEIGHT &&
  b.y < a.y + STEP_CARD_HEIGHT

describe('layoutSteps', () => {
  it('lays steps in a line out left to right', () => {
    const laidOut = layoutSteps(
      [step('idea'), step('build'), step('release')],
      [edge('idea', 'build'), edge('build', 'release')],
    )
    expect(at(laidOut, 'idea').x).toBeLessThan(at(laidOut, 'build').x)
    expect(at(laidOut, 'build').x).toBeLessThan(at(laidOut, 'release').x)
  })

  it('keeps a skip connection pointing left to right', () => {
    const edges = [edge('idea', 'build'), edge('build', 'release'), edge('idea', 'release')]
    const laidOut = layoutSteps([step('idea'), step('build'), step('release')], edges)
    edges.forEach((e) => expect(at(laidOut, e.source).x).toBeLessThan(at(laidOut, e.target).x))
  })

  it('puts parallel steps in one column without overlapping', () => {
    const laidOut = layoutSteps(
      [step('idea'), step('design'), step('build')],
      [edge('idea', 'design'), edge('idea', 'build')],
    )
    expect(at(laidOut, 'design').x).toBe(at(laidOut, 'build').x)
    expect(overlaps(at(laidOut, 'design'), at(laidOut, 'build'))).toBe(false)
  })

  it('orders rows in a column by file order, not id', () => {
    const laidOut = layoutSteps(
      [step('idea'), step('z'), step('a')],
      [edge('idea', 'z'), edge('idea', 'a')],
    )
    expect(at(laidOut, 'z').y).toBeLessThan(at(laidOut, 'a').y)
  })

  it('gives the same positions for the same map', () => {
    const nodes = [step('idea'), step('design'), step('build')]
    const edges = [edge('idea', 'design'), edge('idea', 'build')]
    const positions = (laidOut) => laidOut.map((n) => n.position)
    expect(positions(layoutSteps(nodes, edges))).toEqual(
      positions(layoutSteps(structuredClone(nodes), structuredClone(edges))),
    )
  })

  it('places steps by their connections', () => {
    const nodes = [step('idea'), step('design'), step('build')]
    const fanOut = layoutSteps(nodes, [edge('idea', 'design'), edge('idea', 'build')])
    const chain = layoutSteps(nodes, [edge('idea', 'design'), edge('design', 'build')])
    expect(at(fanOut, 'design').x).toBe(at(fanOut, 'build').x)
    expect(at(chain, 'design').x).toBeLessThan(at(chain, 'build').x)
  })

  it('does not overlap unconnected steps', () => {
    const laidOut = layoutSteps([step('a'), step('b')], [])
    expect(overlaps(at(laidOut, 'a'), at(laidOut, 'b'))).toBe(false)
  })

  it('returns an empty array for an empty map', () => {
    expect(layoutSteps([], [])).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const nodes = [step('idea'), step('build')]
    const edges = [edge('idea', 'build')]
    const nodesBefore = structuredClone(nodes)
    const edgesBefore = structuredClone(edges)
    layoutSteps(nodes, edges)
    expect({ nodes, edges }).toEqual({ nodes: nodesBefore, edges: edgesBefore })
  })

  it('keeps every other node field and only replaces the position', () => {
    const node = { ...step('idea'), ariaLabel: 'Step 1: idea', selected: true }
    const [laidOut] = layoutSteps([node], [])
    expect(laidOut).toEqual({ ...node, position: expect.any(Object) })
    expect(laidOut).not.toBe(node)
  })

  it('finishes and positions every step when the map has a loop', () => {
    const laidOut = layoutSteps([step('a'), step('b')], [edge('a', 'b'), edge('b', 'a')])
    expect(laidOut.map((n) => n.id)).toEqual(['a', 'b'])
    laidOut.forEach((n) => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('keeps a rework loop inside a chain left to right except for the loop-back', () => {
    const laidOut = layoutSteps(
      [step('idea'), step('build'), step('test')],
      [edge('idea', 'build'), edge('build', 'test'), edge('test', 'build')],
    )
    expect(at(laidOut, 'idea').x).toBeLessThan(at(laidOut, 'build').x)
    expect(at(laidOut, 'build').x).toBeLessThan(at(laidOut, 'test').x)
  })

  it('lays out a very long chain without running out of stack', () => {
    const STEP_COUNT = 20_000
    const ids = Array.from({ length: STEP_COUNT }, (_, i) => `s${i}`)
    const edges = ids.slice(1).map((id, i) => edge(ids[i], id))
    const laidOut = layoutSteps(ids.map(step), edges)
    expect(at(laidOut, ids[STEP_COUNT - 1]).x).toBeGreaterThan(at(laidOut, ids[0]).x)
  })

  it('keeps the card width constant in step with --card-width in index.css', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const rem = Number(/--card-width:\s*([\d.]+)rem/.exec(css)?.[1])
    expect(rem * ROOT_FONT_SIZE_PX).toBe(STEP_CARD_WIDTH)
  })
})
