// Pure checks on repair guides. They take the catalog codes, the guide map `{ CODE: text }` and
// the guide text as inputs, and return the problems found as plain sentences that name the guide,
// so a test on fixtures proves each check and a thin gate runs them on the real files.

/** The repair-section line for a code no tool repairs; a line after it tells the user what to do. */
export const NO_TOOL_MARKER = 'No tool repairs this.'

const REPAIR_HEADING = '## Repair with the tools'
const SECTION_HEADINGS = ['## What it means', REPAIR_HEADING, '## Ask the user first']

// Substrings, matched in lower case, that send the agent to the project file. Paraphrases are not
// caught; review does that.
const FILE_ACCESS_PHRASES = [
  'read tool',
  'edit tool',
  'write tool',
  'edit the json',
  'edit the file',
  'by hand',
  'open the file in',
]

// A line that starts this way speaks to the user, who may touch their own file.
const USER_ADDRESS = 'Tell the user'

const NUMBERED_STEP = '1. '

const linesOf = (text) => text.split(/\r?\n/)

const hasText = (lines) => lines.some((line) => line.trim() !== '')

const isHeading = (line) => /^#{1,6} /.test(line)

// Where each wanted heading sits (every line index, so a repeat is visible) and the lines under its
// first occurrence, up to the next heading.
const sections = (text) => {
  const lines = linesOf(text)
  return SECTION_HEADINGS.map((heading) => {
    const lineIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []))
    const rest = lineIndexes.length === 0 ? [] : lines.slice(lineIndexes[0] + 1)
    const end = rest.findIndex(isHeading)
    return { heading, lineIndexes, body: end === -1 ? rest : rest.slice(0, end) }
  })
}

/** The catalog codes that have no guide. */
export const missingGuides = (codes, guides) => codes.filter((code) => !Object.hasOwn(guides, code))

/** The guide codes that are not catalog codes. */
export const orphanGuides = (codes, guides) =>
  Object.keys(guides).filter((code) => !codes.includes(code))

const titleProblems = (code, title, text) => {
  const expected = `# ${code}: ${title}`
  return linesOf(text)[0] === expected ? [] : [`${code}: line 1 must be exactly "${expected}"`]
}

const sectionProblems = (code, found) =>
  found.flatMap(({ heading, lineIndexes, body }) => {
    if (lineIndexes.length === 0) return [`${code}: missing section "${heading}"`]
    if (lineIndexes.length > 1) return [`${code}: section "${heading}" appears more than once`]
    return hasText(body) ? [] : [`${code}: section "${heading}" has no text`]
  })

const orderProblems = (code, found) => {
  const placed = found.filter(({ lineIndexes }) => lineIndexes.length === 1)
  const isInOrder = placed.every(
    ({ lineIndexes }, index) => index === 0 || lineIndexes[0] > placed[index - 1].lineIndexes[0],
  )
  return isInOrder ? [] : [`${code}: sections are out of order`]
}

const repairProblems = (code, found) => {
  const repair = found.find(({ heading }) => heading === REPAIR_HEADING)
  if (repair.lineIndexes.length !== 1) return []
  const hasStepOrMarker = repair.body.some(
    (line) => line.startsWith(NUMBERED_STEP) || line === NO_TOOL_MARKER,
  )
  return hasStepOrMarker
    ? []
    : [
        `${code}: "${repair.heading}" needs a line starting "${NUMBERED_STEP}" or "${NO_TOOL_MARKER}"`,
      ]
}

/**
 * What is wrong with a guide's shape: line 1 is exactly `# <code>: <title>`; the three section
 * headings appear once each, in order, each with text under it; and the repair section has a
 * numbered first step or the no-tool marker.
 */
export const shapeProblems = (code, title, text) => {
  const found = sections(text)
  return [
    ...titleProblems(code, title, text),
    ...sectionProblems(code, found),
    ...orderProblems(code, found),
    ...repairProblems(code, found),
  ]
}

/** The lines that send the agent to the project file, except lines that speak to the user. */
export const fileAccessProblems = (text) =>
  linesOf(text).flatMap((line, index) => {
    const isForbidden = FILE_ACCESS_PHRASES.some((phrase) => line.toLowerCase().includes(phrase))
    return isForbidden && !line.startsWith(USER_ADDRESS)
      ? [`line ${index + 1} sends the agent to the file: "${line}"`]
      : []
  })

/**
 * What is wrong with a guide that must say no tool repairs its code: the repair section has the
 * no-tool marker line, and a later line in that section starts "Tell the user" (what to tell them).
 */
export const noToolProblems = (code, text) => {
  const { body } = sections(text).find(({ heading }) => heading === REPAIR_HEADING)
  const markerIndex = body.indexOf(NO_TOOL_MARKER)
  const hasUserLine =
    markerIndex !== -1 && body.slice(markerIndex + 1).some((line) => line.startsWith(USER_ADDRESS))
  return hasUserLine
    ? []
    : [
        `${code}: "${REPAIR_HEADING}" must have "${NO_TOOL_MARKER}" and then a line starting "${USER_ADDRESS}"`,
      ]
}
