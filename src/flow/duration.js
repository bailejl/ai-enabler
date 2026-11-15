export const NO_VALUE_TEXT = '—'

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 8
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY
const MAX_UNITS_SHOWN = 2

export const formatDuration = (minutes) => {
  const units = [
    { value: Math.floor(minutes / MINUTES_PER_DAY), suffix: 'd' },
    { value: Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR), suffix: 'h' },
    { value: minutes % MINUTES_PER_HOUR, suffix: 'm' },
  ]
  const leading = units.findIndex(({ value }) => value > 0)
  if (leading === -1) return '0m'
  return units
    .slice(leading, leading + MAX_UNITS_SHOWN)
    .filter(({ value }) => value > 0)
    .map(({ value, suffix }) => `${value}${suffix}`)
    .join(' ')
}
