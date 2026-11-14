export const tokens = {
  headerBackground: '#0f172a',
  headerText: '#f8fafc',
  pageBackground: '#f1f5f9',
  menuBackground: '#ffffff',
  menuText: '#0f172a',
  focusRing: '#2563eb',
}

const toKebabCase = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

export const toCssCustomProperties = (colorTokens) =>
  Object.fromEntries(
    Object.entries(colorTokens).map(([name, value]) => [`--${toKebabCase(name)}`, value]),
  )
