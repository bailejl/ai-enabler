const typeOf = (value) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// The "path:type" entries for the value and everything below it. Array elements share the
// path "<path>[]", so each element adds its key paths to the same union.
const collectEntries = (value, path) => {
  const type = typeOf(value)
  const own = [`${path}:${type}`]
  if (type === 'array') {
    return own.concat(...value.map((element) => collectEntries(element, `${path}[]`)))
  }
  if (type === 'object') {
    return own.concat(
      ...Object.entries(value).map(([key, child]) => collectEntries(child, `${path}.${key}`)),
    )
  }
  return own
}

/**
 * A structural signature of a value: every key path with its value type, sorted. Values do not
 * matter, and keys absent on some array elements do not change it.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export const shapeOf = (value) => {
  return [...new Set(collectEntries(value, '$'))].sort()
}
