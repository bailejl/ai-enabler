import { DETAIL_KEYS } from './diagnostics/problem.js'
import { formatCount } from './text.js'

// The list shows this many problems; the rest are counted in one trailing "and N more" line.
export const MAX_LISTED_PROBLEMS = 10

// What an item keeps beyond its code, message and fix. `untrusted` text never reaches the view.
const OPTIONAL_KEYS = DETAIL_KEYS.filter((key) => key !== 'untrusted')

const toItem = (problem) => ({
  code: problem.code,
  message: problem.message,
  fix: problem.fix,
  ...Object.fromEntries(
    OPTIONAL_KEYS.filter((key) => problem[key] !== undefined).map((key) => [key, problem[key]]),
  ),
})

const describeMore = (count) =>
  count > MAX_LISTED_PROBLEMS ? `and ${count - MAX_LISTED_PROBLEMS} more` : null

/**
 * What the shared problems panel shows: a heading, up to MAX_LISTED_PROBLEMS items, and "and N
 * more" in `more` (null when every problem is listed). Each item keeps the problem's code,
 * message and fix, plus its stepId, edgeId and field when it has them.
 * @param {string} heading
 * @param {{ code: string, message: string, fix: string }[]} problems
 * @returns {{ heading: string, items: object[], more: string | null }}
 */
export const toProblemsView = (heading, problems) => ({
  heading,
  items: problems.slice(0, MAX_LISTED_PROBLEMS).map(toItem),
  more: describeMore(problems.length),
})

/**
 * The wording of a rejection, shared by edit and import so both read alike: the heading (subject
 * and problem count), the problems view under it, and the line to speak (the heading and the
 * first problem's message).
 * @param {string} subject What was rejected, e.g. "Edit" or "Import".
 * @param {{ code: string, message: string, fix: string }[]} problems At least one.
 * @returns {{ heading: string, view: ReturnType<typeof toProblemsView>, announcement: string }}
 */
export const toRejection = (subject, problems) => {
  const heading = `${subject} rejected: ${formatCount(problems.length, 'problem')}`
  return {
    heading,
    view: toProblemsView(heading, problems),
    announcement: `${heading}. ${problems[0].message}`,
  }
}
