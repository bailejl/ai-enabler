import { describe, expect, test } from 'vitest'
import { ROUTE, resolveHash, rewriteTarget, toHash } from './routes.js'

const home = { name: ROUTE.HOME }
const project = (id) => ({ name: ROUTE.PROJECT, id })

describe('resolveHash', () => {
  test.each([
    ['', home, '#/'],
    ['#', home, '#/'],
    ['#/', home, '#/'],
    ['#/nowhere', home, '#/'],
    ['#/projects', home, '#/'],
    ['#/projects/', home, '#/'],
    ['#/projects/abc/extra', home, '#/'],
    ['#/projects/abc//', home, '#/'],
    ['#/projects/%E0%A4%A', home, '#/'],
    ['#projects/abc', home, '#/'],
    ['#/projects/abc', project('abc'), '#/projects/abc'],
    ['#/projects/abc/', project('abc'), '#/projects/abc'],
    ['#/projects/a@b', project('a@b'), '#/projects/a@b'],
    ['#/projects/a+b', project('a+b'), '#/projects/a+b'],
    ['#/projects/a,b', project('a,b'), '#/projects/a,b'],
    ['#/projects/a%2Fb', project('a/b'), '#/projects/a%2Fb'],
    ['#/projects/a%20b', project('a b'), '#/projects/a%20b'],
  ])('%j resolves to %j with hash %j', (hash, route, canonical) => {
    expect(resolveHash(hash)).toEqual({ route, hash: canonical })
  })
})

describe('toHash', () => {
  test('home builds "#/"', () => {
    expect(toHash(home)).toBe('#/')
  })

  test.each([
    ['abc', '#/projects/abc'],
    ['a b', '#/projects/a%20b'],
    ['a/b', '#/projects/a%2Fb'],
    ['a b/c', '#/projects/a%20b%2Fc'],
  ])('project %j builds %j', (id, hash) => {
    expect(toHash(project(id))).toBe(hash)
  })

  test.each([home, project('abc'), project('a b'), project('ü'), project('a/b')])(
    '%j round-trips through its hash',
    (route) => {
      expect(resolveHash(toHash(route)).route).toEqual(route)
    },
  )
})

describe('rewriteTarget', () => {
  test.each([
    ['', '#/'],
    ['#/nowhere', '#/'],
    ['#/projects/abc/', '#/projects/abc'],
  ])('non-canonical %j is rewritten to %j', (hash, target) => {
    expect(rewriteTarget(hash)).toBe(target)
  })

  test.each(['#/', '#/projects/abc', '#/projects/a@b'])('canonical %j is left alone', (hash) => {
    expect(rewriteTarget(hash)).toBeNull()
  })
})
