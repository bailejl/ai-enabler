import { describe, it, expect } from 'vitest'
import { initialEdges, initialNodes } from './initialFlow.js'
import { createStarterMemoryProject, createStarterProject } from './project.js'
import { validateProjectFile } from './schema/validate.js'

describe('createStarterMemoryProject', () => {
  it('holds the starter project with the id from the injected generator', () => {
    expect(createStarterMemoryProject({ newId: () => 'fixed-id' }).project).toEqual({
      id: 'fixed-id',
      name: 'Untitled Project',
    })
  })

  it('holds the starter stages and the connections between them', () => {
    const { nodes, edges } = createStarterMemoryProject()
    expect(nodes.map((node) => node.id)).toEqual(initialNodes.map((node) => node.id))
    expect(edges).toEqual(initialEdges)
  })

  it('passes project file validation', () => {
    expect(validateProjectFile(createStarterMemoryProject()).problems).toEqual([])
  })

  it('carries no runtime fields on its steps', () => {
    const { nodes } = createStarterMemoryProject()
    expect(nodes.every((node) => !Object.hasOwn(node, 'ariaLabel'))).toBe(true)
  })

  it('does not share the starter nodes, so a change to one cannot reach the other', () => {
    const { nodes } = createStarterMemoryProject()
    expect(nodes[0]).not.toBe(initialNodes[0])
    expect(nodes[0].position).not.toBe(initialNodes[0].position)
  })
})

describe('createStarterProject', () => {
  it('names the project "Untitled Project"', () => {
    expect(createStarterProject().name).toBe('Untitled Project')
  })

  it('takes the id from the injected generator', () => {
    expect(createStarterProject({ newId: () => 'fixed-id' }).id).toBe('fixed-id')
  })

  it('returns exactly the id and the default name', () => {
    expect(createStarterProject({ newId: () => 'fixed-id' })).toEqual({
      id: 'fixed-id',
      name: 'Untitled Project',
    })
  })

  it('defaults the id to a non-empty string', () => {
    const { id } = createStarterProject()
    expect(typeof id).toBe('string')
    expect(id).not.toBe('')
  })

  it('gives two default calls different ids', () => {
    expect(createStarterProject().id).not.toBe(createStarterProject().id)
  })
})
