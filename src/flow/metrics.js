import { formatDuration, NO_VALUE_TEXT } from './duration.js'

const DEFAULT_PERCENT_COMPLETE_ACCURATE = 100
const PERCENT = 100

export const STATUS = {
  onTarget: 'on-target',
  watch: 'watch',
  needsAttention: 'needs-attention',
}

export const STATUS_LABELS = {
  [STATUS.onTarget]: 'On target',
  [STATUS.watch]: 'Watch',
  [STATUS.needsAttention]: 'Needs attention',
}

// Ratings read the value rounded to `digits` (what the tile displays). The first band whose
// inclusive min/max contains the value wins; the last band has no limits and catches the rest.
const THRESHOLDS = {
  flowEfficiency: {
    digits: 1,
    bands: [
      { status: STATUS.onTarget, min: 70 },
      { status: STATUS.watch, min: 20 },
      { status: STATUS.needsAttention },
    ],
  },
  firstPassYield: {
    digits: 1,
    bands: [
      { status: STATUS.onTarget, min: 70 },
      { status: STATUS.watch, min: 50 },
      { status: STATUS.needsAttention },
    ],
  },
  totalQueue: {
    digits: 0,
    bands: [
      { status: STATUS.onTarget, max: 19 },
      { status: STATUS.watch, max: 50 },
      { status: STATUS.needsAttention },
    ],
  },
}

const roundTo = (value, digits) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const isInBand = (value, { min = -Infinity, max = Infinity }) => value >= min && value <= max

export const rateMetric = (key, rawValue) => {
  if (!Object.hasOwn(THRESHOLDS, key) || !Number.isFinite(rawValue)) return null
  const threshold = THRESHOLDS[key]
  const value = roundTo(rawValue, threshold.digits)
  return threshold.bands.find((band) => isInBand(value, band)).status
}

const sumBy = (field, fallback) => (steps) =>
  steps.reduce((total, step) => total + (step[field] ?? fallback), 0)

const totalProcessTime = sumBy('pt', 0)
const totalLeadTime = sumBy('lt', 0)
const totalQueue = sumBy('queue', 0)

const firstPassYield = (steps) =>
  PERCENT *
  steps.reduce(
    (product, step) => product * ((step.ca ?? DEFAULT_PERCENT_COMPLETE_ACCURATE) / PERCENT),
    1,
  )

export const computeMetrics = (steps) => {
  const hasSteps = steps.length > 0
  const processTime = totalProcessTime(steps)
  const leadTime = totalLeadTime(steps)
  return {
    totalLeadTime: leadTime,
    totalProcessTime: processTime,
    flowEfficiency: leadTime > 0 ? (processTime / leadTime) * PERCENT : null,
    firstPassYield: hasSteps ? firstPassYield(steps) : null,
    totalQueue: totalQueue(steps),
    avgProcessTime: hasSteps ? Math.round(processTime / steps.length) : null,
    steps: steps.length,
  }
}

const formatPercent = (value) => `${roundTo(value, 1).toFixed(1)}%`

const TILES = [
  { key: 'totalLeadTime', label: 'Total lead time', format: formatDuration },
  { key: 'totalProcessTime', label: 'Total process time', format: formatDuration },
  { key: 'flowEfficiency', label: 'Flow efficiency', format: formatPercent },
  { key: 'firstPassYield', label: 'First pass yield', format: formatPercent },
  { key: 'totalQueue', label: 'Total queue', format: (value) => String(roundTo(value, 0)) },
  { key: 'avgProcessTime', label: 'Avg process time', format: formatDuration },
  { key: 'steps', label: 'Steps', format: String },
]

export const metricTiles = (steps) => {
  const metrics = computeMetrics(steps)
  const hasSteps = steps.length > 0
  return TILES.map(({ key, label, format }) => {
    const value = hasSteps ? metrics[key] : null
    const status = rateMetric(key, value)
    return {
      key,
      label,
      text: value === null ? NO_VALUE_TEXT : format(value),
      status,
      statusLabel: status ? STATUS_LABELS[status] : null,
    }
  })
}
