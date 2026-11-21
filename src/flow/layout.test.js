import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { layoutSteps, STEP_CARD_HEIGHT, STEP_CARD_WIDTH } from './layout.js'

const step = (id) => ({ id, type: 'step', position: { x: 0, y: 0 }, data: { label: id } })
const edge = (source, target) => ({ id: `${source}->${target}`, source, target })
const at = (laidOut, id) => laidOut.find((n) => n.id === id).position

const overlap = (a, b) =>
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
    expect(overlap(at(laidOut, 'design'), at(laidOut, 'build'))).toBe(false)
  })

  it('orders rows in a column by file order, not id', () => {
    const laidOut = layoutSteps(
      [step('idea'), step('z'), step('a')],
      [edge('idea', 'z'), edge('idea', 'a')],
    )
    expect(at(laidOut, 'z').y).toBeLessThan(at(laidOut, 'a').y)
  })

  it('gives the same positions for the same map and different ones for different connections', () => {
    const nodes = [step('idea'), step('design'), step('build')]
    const edges = [edge('idea', 'design'), edge('idea', 'build')]
    const positions = (laidOut) => laidOut.map((n) => n.position)
    expect(positions(layoutSteps(nodes, edges))).toEqual(positions(layoutSteps(nodes, edges)))
    const chained = [edge('idea', 'design'), edge('design', 'build')]
    expect(positions(layoutSteps(nodes, chained))).not.toEqual(positions(layoutSteps(nodes, edges)))
  })

  it('does not overlap unconnected steps', () => {
    const laidOut = layoutSteps([step('a'), step('b')], [])
    expect(overlap(at(laidOut, 'a'), at(laidOut, 'b'))).toBe(false)
  })

  it('returns an empty array for an empty map', () => {
    expect(layoutSteps([], [])).toEqual([])
  })

  it('does not mutate its inputs and keeps every other node field', () => {
    const nodes = [{ ...step('idea'), ariaLabel: 'Step 1: idea', selected: true }, step('build')]
    const edges = [edge('idea', 'build')]
    const nodesBefore = structuredClone(nodes)
    const edgesBefore = structuredClone(edges)
    const laidOut = layoutSteps(nodes, edges)
    expect(nodes).toEqual(nodesBefore)
    expect(edges).toEqual(edgesBefore)
    expect(laidOut[0]).toEqual({ ...nodes[0], position: laidOut[0].position })
    expect(laidOut[0]).not.toBe(nodes[0])
  })

  it('finishes and positions every step when the map has a loop', () => {
    const laidOut = layoutSteps([step('a'), step('b')], [edge('a', 'b'), edge('b', 'a')])
    expect(laidOut.map((n) => n.id)).toEqual(['a', 'b'])
    laidOut.forEach((n) => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('keeps the card width constant in step with --card-width in index.css', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const rem = Number(/--card-width:\s*([\d.]+)rem/.exec(css)?.[1])
    expect(rem * 16).toBe(STEP_CARD_WIDTH)
  })
})
