import { describe, it, expect } from 'vitest'
import { createStarterProject } from './project.js'

describe('createStarterProject', () => {
  it('names the project "Untitled Project"', () => {
    expect(createStarterProject().name).toBe('Untitled Project')
  })

  it('takes the id from the injected generator', () => {
    expect(createStarterProject({ newId: () => 'fixed-id' }).id).toBe('fixed-id')
  })

  it('gives two default calls different ids', () => {
    expect(createStarterProject().id).not.toBe(createStarterProject().id)
  })
})
