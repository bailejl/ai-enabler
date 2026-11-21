import { describe, expect, test, vi } from 'vitest'
import { ROUTE, resolveHash, syncHash, toHash } from './routes.js'

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

  test('a project encodes its id', () => {
    expect(toHash(project('a b/c'))).toBe('#/projects/a%20b%2Fc')
  })

  test.each([home, project('abc'), project('a b'), project('ü'), project('a/b')])(
    '%j round-trips through its hash',
    (route) => {
      expect(resolveHash(toHash(route)).route).toEqual(route)
    },
  )
})

describe('syncHash', () => {
  const fakeWindow = (hash) => ({
    location: { hash },
    history: { state: { kept: true }, replaceState: vi.fn() },
  })

  test('a non-canonical hash is replaced once, keeping history state', () => {
    const win = fakeWindow('#/nowhere')
    expect(syncHash(win)).toEqual(home)
    expect(win.history.replaceState).toHaveBeenCalledTimes(1)
    expect(win.history.replaceState).toHaveBeenCalledWith({ kept: true }, '', '#/')
  })

  test('a trailing slash is replaced with the canonical project hash', () => {
    const win = fakeWindow('#/projects/abc/')
    expect(syncHash(win)).toEqual(project('abc'))
    expect(win.history.replaceState).toHaveBeenCalledWith({ kept: true }, '', '#/projects/abc')
  })

  test.each(['#/', '#/projects/abc', '#/projects/a@b'])('canonical %j is left alone', (hash) => {
    const win = fakeWindow(hash)
    syncHash(win)
    expect(win.history.replaceState).not.toHaveBeenCalled()
  })
})
