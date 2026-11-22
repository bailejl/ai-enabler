// The list shows this many problems; the rest are counted in one trailing "and N more" line.
export const MAX_LISTED_PROBLEMS = 10

// What an item keeps beyond its code, message and fix. `untrusted` text never reaches the view.
const OPTIONAL_KEYS = ['stepId', 'edgeId', 'field']

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
