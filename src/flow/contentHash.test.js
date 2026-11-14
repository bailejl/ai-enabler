import { describe, it, expect } from 'vitest'
import { canonicalJson, contentHash } from './contentHash.js'

// sha256 of the two bytes "{}".
const SHA256_OF_EMPTY_OBJECT = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'

const FORMAT = /^sha256-[0-9a-f]{64}$/

// A fake digest that records the bytes it was given and returns 32 bytes of 0xab.
const recordingDigest = () => {
  const calls = []
  const digest = async (bytes) => {
    calls.push(bytes)
    return new Uint8Array(32).fill(0xab).buffer
  }
  return { digest, calls }
}

const bytesSeenFor = async (file) => {
  const { digest, calls } = recordingDigest()
  await contentHash(file, { digest })
  return new TextDecoder().decode(calls[0])
}

describe('canonicalJson', () => {
  it.each([
    ['top-level keys', { b: 1, a: 2 }, '{"a":2,"b":1}'],
    ['nested keys', { x: { b: 1, a: 2 } }, '{"x":{"a":2,"b":1}}'],
    ['keys inside arrays', [{ b: 1, a: 2 }], '[{"a":2,"b":1}]'],
  ])('sorts %s', (_label, value, expected) => {
    expect(canonicalJson(value)).toBe(expected)
  })

  it('keeps array order', () => {
    expect(canonicalJson({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}')
  })

  it('writes no whitespace', () => {
    expect(canonicalJson({ a: 'x y', b: [1, 2] })).toBe('{"a":"x y","b":[1,2]}')
  })

  it('does not change the value it is given', () => {
    const value = { b: 1, a: { d: 1, c: 2 } }
    canonicalJson(value)
    expect(Object.keys(value)).toEqual(['b', 'a'])
    expect(Object.keys(value.a)).toEqual(['d', 'c'])
  })
})

describe('contentHash', () => {
  it('hashes {} to the known SHA-256 vector with the default digest', async () => {
    expect(await contentHash({})).toBe(`sha256-${SHA256_OF_EMPTY_OBJECT}`)
  })

  it('writes sha256- plus 64 lowercase hex characters', async () => {
    const hash = await contentHash({ nodes: [], edges: [] })
    expect(hash).toMatch(FORMAT)
  })

  it('pads each byte to two hex digits', async () => {
    const digest = async () => new Uint8Array([0x00, 0x0f, 0xff]).buffer
    expect(await contentHash({}, { digest })).toBe('sha256-000fff')
  })

  it('does not depend on key order', async () => {
    const one = await contentHash({ a: 1, b: { c: 2, d: 3 } })
    const other = await contentHash({ b: { d: 3, c: 2 }, a: 1 })
    expect(one).toBe(other)
  })

  it.each([
    ['a changed value', { a: 2 }],
    ['a changed key', { z: 1 }],
    ['an added key', { a: 1, b: 2 }],
    ['a changed nested value', { a: 1, n: { x: 2 } }],
  ])('changes with %s', async (_label, edited) => {
    const original = { a: 1, n: { x: 1 } }
    expect(await contentHash(edited)).not.toBe(await contentHash(original))
  })

  it('ignores the top-level contentHash', async () => {
    const plain = await contentHash({ a: 1 })
    expect(await contentHash({ a: 1, contentHash: 'sha256-stale' })).toBe(plain)
    expect(await contentHash({ a: 1, contentHash: 42 })).toBe(plain)
  })

  it('keeps a nested contentHash key', async () => {
    const plain = await contentHash({ a: { b: 1 } })
    expect(await contentHash({ a: { b: 1, contentHash: 'x' } })).not.toBe(plain)
  })

  it('digests the canonical JSON without contentHash', async () => {
    expect(await bytesSeenFor({ b: 1, contentHash: 'x', a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('encodes the canonical JSON as UTF-8', async () => {
    const { digest, calls } = recordingDigest()
    await contentHash({ label: 'Café ☕' }, { digest })
    expect([...calls[0]]).toEqual([...new TextEncoder().encode('{"label":"Café ☕"}')])
  })

  it('does not change the file it is given', async () => {
    const file = Object.freeze({ b: 1, a: 2, contentHash: 'x' })
    await expect(contentHash(file)).resolves.toMatch(FORMAT)
  })
})
