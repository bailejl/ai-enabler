import { describe, expect, it } from 'vitest'
import { makeRun, onlyProblem } from './testHelpers.js'

const newId = () => 'conn-new'

const node = (id, label) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label },
})

const ideaToBuild = { id: 'conn-1', source: 'idea', target: 'build' }

const projectWith = (edges = []) =>
  Object.freeze({
    project: { id: 'p-1', name: 'Checkout' },
    nodes: [node('idea', 'Idea'), node('build', 'Build')],
    edges,
  })

const run = makeRun(newId)

describe('connect', () => {
  it('adds the connection, gives its id and names the steps by title', () => {
    const project = projectWith()
    const result = run(project, 'connect', { sourceId: 'idea', targetId: 'build' })
    expect(result.ok).toBe(true)
    expect(result.created).toBe('conn-new')
    expect(result.project.edges).toEqual([{ id: 'conn-new', source: 'idea', target: 'build' }])
    expect(result.summary).toBe('Connected "Idea" to "Build" (conn-new)')
    expect(project.edges).toEqual([])
  })

  it('truncates a long title in the summary', () => {
    const long = 'T'.repeat(200)
    const project = { ...projectWith(), nodes: [node('idea', long), node('build', 'Build')] }
    const result = run(project, 'connect', { sourceId: 'idea', targetId: 'build' })
    expect(result.summary).toBe(`Connected "${'T'.repeat(79)}…" to "Build" (conn-new)`)
  })

  it('names a step with a blank title by its position in the summary', () => {
    const project = { ...projectWith(), nodes: [node('idea', ''), node('build', 'Build')] }
    const result = run(project, 'connect', { sourceId: 'idea', targetId: 'build' })
    expect(result.summary).toBe('Connected Step #1 to "Build" (conn-new)')
  })

  it.each([
    ['Build to Build', { sourceId: 'build', targetId: 'build' }, 'CONN_SELF'],
    ['Idea to Build again', { sourceId: 'idea', targetId: 'build' }, 'CONN_DUPLICATE'],
    ['Build to Idea', { sourceId: 'build', targetId: 'idea' }, 'CONN_LOOP'],
    ['Idea to "ghost"', { sourceId: 'idea', targetId: 'ghost' }, 'CONN_ENDPOINT_MISSING'],
    ['"ghost" to Build', { sourceId: 'ghost', targetId: 'build' }, 'CONN_ENDPOINT_MISSING'],
    ['no source', { targetId: 'build' }, 'CONN_ENDPOINT_MISSING'],
    ['no target', { sourceId: 'idea' }, 'CONN_ENDPOINT_MISSING'],
  ])('rejects %s with %s and leaves the project unchanged', (_label, args, code) => {
    const project = projectWith([ideaToBuild])
    const result = run(project, 'connect', args)
    expect(onlyProblem(result).code).toBe(code)
    expect(result.project).toBe(project)
    expect(result).not.toHaveProperty('created')
  })

  it('carries the validator message and fix for a rejected connection', () => {
    const result = run(projectWith([ideaToBuild]), 'connect', {
      sourceId: 'build',
      targetId: 'idea',
    })
    expect(onlyProblem(result)).toMatchObject({
      code: 'CONN_LOOP',
      message: 'Connection 2 closes a loop in the connections.',
      fix: 'Remove a connection so the flow runs one way.',
    })
  })

  it('rejects arguments it does not accept', () => {
    const project = projectWith()
    const result = run(project, 'connect', { sourceId: 'idea', targetId: 'build', id: 'mine' })
    expect(onlyProblem(result).code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(result.project).toBe(project)
  })
})

describe('disconnect', () => {
  it('removes the connection and names the steps by title', () => {
    const project = projectWith([ideaToBuild])
    const result = run(project, 'disconnect', { sourceId: 'idea', targetId: 'build' })
    expect(result.ok).toBe(true)
    expect(result.project.edges).toEqual([])
    expect(result.summary).toBe('Disconnected "Idea" from "Build"')
    expect(result).not.toHaveProperty('created')
    expect(project.edges).toEqual([ideaToBuild])
  })

  it('keeps the connections that share only the source or only the target', () => {
    const sameSource = { id: 'conn-2', source: 'idea', target: 'release' }
    const sameTarget = { id: 'conn-3', source: 'release', target: 'build' }
    const project = {
      ...projectWith([ideaToBuild, sameSource, sameTarget]),
      nodes: [node('idea', 'Idea'), node('build', 'Build'), node('release', 'Release')],
    }
    const result = run(project, 'disconnect', { sourceId: 'idea', targetId: 'build' })
    expect(result.project.edges).toEqual([sameSource, sameTarget])
  })

  it('connects and disconnects back to no connections', () => {
    const connected = run(projectWith(), 'connect', { sourceId: 'idea', targetId: 'build' })
    const result = run(connected.project, 'disconnect', { sourceId: 'idea', targetId: 'build' })
    expect(result.ok).toBe(true)
    expect(result.project.edges).toEqual([])
  })

  it.each([
    ['unconnected steps', [], { sourceId: 'idea', targetId: 'build' }],
    ['the opposite direction', [ideaToBuild], { sourceId: 'build', targetId: 'idea' }],
    ['a step that does not exist', [ideaToBuild], { sourceId: 'idea', targetId: 'ghost' }],
  ])('fails with CONN_NOT_FOUND for %s and leaves the project unchanged', (_label, edges, args) => {
    const project = projectWith(edges)
    const result = run(project, 'disconnect', args)
    expect(onlyProblem(result).code).toBe('CONN_NOT_FOUND')
    expect(result.project).toBe(project)
  })

  it('names the steps by title, shortened, and keeps the raw ids whole in untrusted', () => {
    const long = 'x'.repeat(200)
    const found = onlyProblem(
      run(projectWith(), 'disconnect', { sourceId: 'idea', targetId: long }),
    )
    expect(found.message).toBe(`No connection joins "Idea" to "${'x'.repeat(79)}…".`)
    expect(found.untrusted).toEqual({ source: 'idea', target: long })
    expect(found.fix).toBe('Use the ids of two steps that are connected, source first.')
    expect(found).not.toHaveProperty('params')
  })

  it('names two steps by title when they exist but are not connected', () => {
    const found = onlyProblem(
      run(projectWith(), 'disconnect', { sourceId: 'build', targetId: 'idea' }),
    )
    expect(found.message).toBe('No connection joins "Build" to "Idea".')
    expect(found.untrusted).toEqual({ source: 'build', target: 'idea' })
  })

  it('names a step with a blank title by its position', () => {
    const project = { ...projectWith(), nodes: [node('idea', ''), node('build', 'Build')] }
    const found = onlyProblem(run(project, 'disconnect', { sourceId: 'idea', targetId: 'build' }))
    expect(found.message).toBe('No connection joins Step #1 to "Build".')
  })

  it.each([
    ['the source does not exist', { sourceId: 'ghost', targetId: 'build' }, 'sourceId'],
    ['the target does not exist', { sourceId: 'idea', targetId: 'ghost' }, 'targetId'],
    ['both exist', { sourceId: 'build', targetId: 'idea' }, 'targetId'],
  ])('points the field at the end that fails when %s', (_label, args, field) => {
    expect(onlyProblem(run(projectWith(), 'disconnect', args)).field).toBe(field)
  })

  it.each([
    ['no arguments', {}, ['sourceId', 'targetId']],
    ['no source', { targetId: 'build' }, ['sourceId']],
    ['no target', { sourceId: 'idea' }, ['targetId']],
    ['ids that are not text', { sourceId: 5, targetId: { toString: 1 } }, ['sourceId', 'targetId']],
  ])('asks for the step ids with CONN_TARGET_INVALID for %s', (_label, args, fields) => {
    const project = projectWith([ideaToBuild])
    const result = run(project, 'disconnect', args)
    expect(result.ok).toBe(false)
    expect(result.problems.map(({ code }) => code)).toEqual(fields.map(() => 'CONN_TARGET_INVALID'))
    expect(result.problems.map(({ field }) => field)).toEqual(fields)
    expect(result.project).toBe(project)
    result.problems.forEach((found, i) => {
      expect(found.message).toBe(
        `This command needs the id of a step (${fields[i]}). Valid steps: "Idea" (idea), "Build" (build).`,
      )
      expect(found.untrusted).toEqual({
        steps: [
          { id: 'idea', title: 'Idea' },
          { id: 'build', title: 'Build' },
        ],
      })
      expect(JSON.stringify(found)).not.toContain('toString')
    })
  })

  it('treats an empty id as text, so the connection is simply not found', () => {
    const found = onlyProblem(run(projectWith(), 'disconnect', { sourceId: '', targetId: 'build' }))
    expect(found.code).toBe('CONN_NOT_FOUND')
  })
})
