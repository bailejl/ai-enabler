export const tokens = {
  headerBackground: '#0f172a',
  headerText: '#f8fafc',
  pageBackground: '#f1f5f9',
  menuBackground: '#ffffff',
  menuText: '#0f172a',
  focusRing: '#2563eb',
  tileText: '#0f172a',
  tileBorder: '#64748b',
  statusOnTargetBackground: '#dcfce7',
  statusWatchBackground: '#fef3c7',
  statusNeedsAttentionBackground: '#fee2e2',
  statusNoneBackground: '#ffffff',
  cardBackground: '#ffffff',
  cardText: '#0f172a',
  cardBorder: '#cbd5e1',
  queueBadgeBackground: '#fef08a',
  queueBadgeText: '#422006',
  queueBadgeBorder: '#a16207',
  batchBadgeBackground: '#bfdbfe',
  batchBadgeText: '#172554',
  batchBadgeBorder: '#1d4ed8',
  edgeStroke: '#64748b',
  arrowhead: '#475569',
  handleDot: '#475569',
}

const toKebabCase = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

export const toCssCustomProperties = (colorTokens) =>
  Object.fromEntries(
    Object.entries(colorTokens).map(([name, value]) => [`--${toKebabCase(name)}`, value]),
  )
