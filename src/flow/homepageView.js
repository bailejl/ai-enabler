// What a homepage card shows for a saved project's index entry. The store sorts; this keeps order.

const dateFormat = (timeZone) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone })

// A time that does not parse shows as stored, so one bad entry cannot blank the page.
const formatTime = (format, iso) => {
  const time = new Date(iso)
  return Number.isNaN(time.getTime()) ? String(iso) : format.format(time)
}

/** The link to a project's page. */
export const projectHref = (id) => `#/projects/${encodeURIComponent(id)}`

/**
 * One card item per index entry, in the given order: `{ id, name, modifiedAt, modifiedText,
 * href }`. `modifiedText` reads like "22 Nov 2026, 10:00" in `timeZone` (the browser's by default),
 * and `modifiedAt` is the ISO time for a `<time datetime>`.
 * @param {{ id: string, name: string, modifiedAt: string }[]} entries
 * @param {{ timeZone?: string }} [options] timeZone is injected so tests are deterministic.
 */
export const toCardItems = (entries, { timeZone } = {}) => {
  const format = dateFormat(timeZone)
  return entries.map(({ id, name, modifiedAt }) => ({
    id,
    name,
    modifiedAt,
    modifiedText: formatTime(format, modifiedAt),
    href: projectHref(id),
  }))
}
