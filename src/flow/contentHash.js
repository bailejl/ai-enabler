import { isObject } from './schema/primitives.js'

const HASH_FIELD = 'contentHash'
const HASH_PREFIX = 'sha256-'

const HEX_RADIX = 16
const HEX_DIGITS_PER_BYTE = 2

// Code-unit order, not locale order, so every machine gets the same bytes.
const compareKeys = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)

const canonicalEntry = ([key, value]) => `${JSON.stringify(key)}:${canonicalValue(value)}`

const isDefinedEntry = ([, value]) => value !== undefined

// Built by hand because JSON.stringify emits integer-like keys first, whatever order they were
// inserted in. Like JSON.stringify, it drops undefined properties and writes undefined array
// items as null.
const canonicalValue = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`
  if (isObject(value)) {
    const entries = Object.entries(value).filter(isDefinedEntry).sort(compareKeys)
    return `{${entries.map(canonicalEntry).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// JSON with object keys sorted at every level and no whitespace. Array order is kept.
export const canonicalJson = canonicalValue

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
