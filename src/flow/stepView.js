import { formatDuration, NO_VALUE_TEXT } from './duration.js'

const formatPercent = (value) => `${Math.round(value)}%`

const ROWS = [
  { key: 'pt', abbreviation: 'PT', spokenName: 'process time', format: formatDuration },
  { key: 'lt', abbreviation: 'LT', spokenName: 'lead time', format: formatDuration },
  {
    key: 'ca',
    abbreviation: '%C&A',
    spokenName: 'percent complete and accurate',
    format: formatPercent,
  },
]

const hasValue = (value) => value !== undefined && value !== null

const toRow =
  (data) =>
  ({ key, abbreviation, spokenName, format }) => ({
    key,
    abbreviation,
    spokenName,
    text: hasValue(data[key]) ? format(data[key]) : NO_VALUE_TEXT,
  })

// A badge shows only for a positive count; its letter cue keeps it from relying on color.
const toBadge = (count, letter, spokenName) =>
  count > 0 ? { text: `${letter} ${count}`, name: spokenName(count) } : null

/**
 * What a step card shows for one step's data.
 *
 * @param {{ label: string, pt?: number, lt?: number, ca?: number, queue?: number, batch?: number }} data
 * @returns {{
 *   title: string,
 *   rows: { key: string, abbreviation: string, spokenName: string, text: string }[],
 *   queueBadge: { text: string, name: string } | null,
 *   batchBadge: { text: string, name: string } | null,
 * }}
 */
export const toStepView = (data) => ({
  title: data.label,
  rows: ROWS.map(toRow(data)),
  queueBadge: toBadge(data.queue, 'Q', (count) => `${count} items waiting`),
  batchBadge: toBadge(data.batch, 'B', (count) => `Batch size ${count}`),
})
