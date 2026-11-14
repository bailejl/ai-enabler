import { isObject } from './schema/primitives.js'

const HASH_FIELD = 'contentHash'
const HASH_PREFIX = 'sha256-'

const HEX_RADIX = 16
const HEX_DIGITS_PER_BYTE = 2

// Code-unit order, not locale order, so every machine gets the same bytes.
const compareKeys = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)

const sortKeys = (_key, value) =>
  isObject(value) ? Object.fromEntries(Object.entries(value).sort(compareKeys)) : value

// JSON with object keys sorted at every level and no whitespace. Array order is kept.
export const canonicalJson = (value) => JSON.stringify(value, sortKeys)

const sha256 = (bytes) => globalThis.crypto.subtle.digest('SHA-256', bytes)

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'),
  ).join('')

const withoutHash = (file) =>
  Object.fromEntries(Object.entries(file).filter(([key]) => key !== HASH_FIELD))

// "sha256-" plus the lowercase hex SHA-256 of the file's canonical JSON, UTF-8 encoded, without
// its top-level contentHash. digest is injectable: it takes bytes and resolves to an ArrayBuffer.
export const contentHash = async (file, { digest = sha256 } = {}) => {
  const bytes = new TextEncoder().encode(canonicalJson(withoutHash(file)))
  return `${HASH_PREFIX}${toHex(await digest(bytes))}`
}
