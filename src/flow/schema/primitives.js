export const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
