const typeOf = (value) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// Appends "path:type" entries for the value and everything below it. Array elements share the
// path "<path>[]", so each element adds its key paths to the same union.
const collectEntries = (value, path, entries) => {
  const type = typeOf(value)
  entries.add(`${path}:${type}`)
  if (type === 'array') value.forEach((element) => collectEntries(element, `${path}[]`, entries))
  if (type === 'object') {
    Object.entries(value).forEach(([key, child]) =>
      collectEntries(child, `${path}.${key}`, entries),
    )
  }
}

/**
 * A structural signature of a value: every key path with its value type, sorted. Values do not
 * matter, and keys absent on some array elements do not change it.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export const shapeOf = (value) => {
  const entries = new Set()
  collectEntries(value, '$', entries)
  return [...entries].sort()
}
