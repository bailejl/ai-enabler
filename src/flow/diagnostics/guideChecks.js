// Pure checks on repair guides. They take the catalog codes, the guide map `{ CODE: text }` and
// the guide text as inputs, and return the problems found as plain sentences. The checks on one
// guide's text take its code first and start each sentence with it, so a failure names the guide.
// A test on fixtures proves each check and a thin gate runs them on the real files.

/** The repair-section line for a code no tool repairs; a line after it tells the user what to do. */
export const NO_TOOL_MARKER = 'No tool repairs this.'

const MEANING_HEADING = '## What it means'
const REPAIR_HEADING = '## Repair with the tools'
/** The title of the section that says what to ask the user; the skills name it too. */
export const ASK_TITLE = 'Ask the user first'
const ASK_HEADING = `## ${ASK_TITLE}`
const SECTION_HEADINGS = [MEANING_HEADING, REPAIR_HEADING, ASK_HEADING]

// What the "Ask the user first" section holds when there is nothing to ask.
const NOTHING_TO_ASK = 'None.'

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

/** The tools that remove or drop work. A guide that calls one must not answer "None." under "Ask the user first". */
export const DESTRUCTIVE_TOOLS = Object.freeze(['remove_step', 'disconnect', 'discard_changes'])

// A backticked span is checked by its whole content, and only when it has one of these shapes:
// snake_case is a tool, camelCase a property, kebab-case a gate and UPPER_SNAKE a catalog code.
// Any other span (one word, a path, JSON) is not checked.
const NAME_CLASSES = [
  { kind: 'tool', shape: /^[a-z]+(_[a-z]+)+$/, list: 'tools' },
  { kind: 'property', shape: /^[a-z]+([A-Z][a-z]+)+$/, list: 'properties' },
  { kind: 'gate', shape: /^[a-z]+(-[a-z]+)+$/, list: 'gates' },
  { kind: 'catalog code', shape: /^[A-Z]+(_[A-Z0-9]+)+$/, list: 'codes' },
]

const linesOf = (text) => text.split(/\r?\n/)

const hasText = (lines) => lines.some((line) => line.trim() !== '')

const isHeading = (line) => /^#{1,6} /.test(line)

// Where each wanted heading sits (every line index, so a repeat is visible) and the lines under its
// first occurrence, up to the next heading.
const findSections = (text) => {
  const lines = linesOf(text)
  return SECTION_HEADINGS.map((heading) => {
    const lineIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []))
    const rest = lineIndexes.length === 0 ? [] : lines.slice(lineIndexes[0] + 1)
    const end = rest.findIndex(isHeading)
    return { heading, lineIndexes, body: end === -1 ? rest : rest.slice(0, end) }
  })
}

const sectionNamed = (found, wantedHeading) =>
  found.find(({ heading }) => heading === wantedHeading)

/** The catalog codes that have no guide. */
export const missingGuides = (catalogCodes, guides) =>
  catalogCodes.filter((code) => !Object.hasOwn(guides, code))

/** The guide codes that are not catalog codes. */
export const orphanGuides = (catalogCodes, guides) =>
  Object.keys(guides).filter((code) => !catalogCodes.includes(code))

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
  const repair = sectionNamed(found, REPAIR_HEADING)
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
 * numbered step (a line starting `1. `) or the no-tool marker line.
 */
export const shapeProblems = (code, title, text) => {
  const found = findSections(text)
  return [
    ...titleProblems(code, title, text),
    ...sectionProblems(code, found),
    ...orderProblems(code, found),
    ...repairProblems(code, found),
  ]
}

/** The lines that send the agent to the project file, except lines that speak to the user. */
export const fileAccessProblems = (code, text) =>
  linesOf(text).flatMap((line, index) => {
    const isForbidden = FILE_ACCESS_PHRASES.some((phrase) => line.toLowerCase().includes(phrase))
    return isForbidden && !line.startsWith(USER_ADDRESS)
      ? [`${code}: line ${index + 1} sends the agent to the file: "${line}"`]
      : []
  })

/**
 * What is wrong with a guide that must say no tool repairs its code: the repair section has the
 * no-tool marker line, no numbered step, and a line after the marker that starts "Tell the user"
 * (what to tell them).
 */
export const noToolProblems = (code, text) => {
  const { body } = sectionNamed(findSections(text), REPAIR_HEADING)
  const markerIndex = body.indexOf(NO_TOOL_MARKER)
  const hasUserLine =
    markerIndex !== -1 && body.slice(markerIndex + 1).some((line) => line.startsWith(USER_ADDRESS))
  const hasNumberedStep = markerIndex !== -1 && body.some((line) => line.startsWith(NUMBERED_STEP))
  return [
    ...(hasUserLine
      ? []
      : [
          `${code}: "${REPAIR_HEADING}" must have "${NO_TOOL_MARKER}" and then a line starting "${USER_ADDRESS}"`,
        ]),
    ...(hasNumberedStep
      ? [`${code}: "${REPAIR_HEADING}" must have no line starting "${NUMBERED_STEP}"`]
      : []),
  ]
}

const BACKTICKED_SPAN = /`([^`\n]+)`/g

/**
 * The backticked names in a guide's text that the server does not have. `names` holds the real
 * `tools`, `properties` (argument, detail and project-file field names), `gates` and `codes`
 * (catalog keys).
 */
export const unknownNameProblems = (code, text, names) =>
  [...text.matchAll(BACKTICKED_SPAN)].flatMap(([, span]) => {
    const nameClass = NAME_CLASSES.find(({ shape }) => shape.test(span))
    return nameClass && !names[nameClass.list].includes(span)
      ? [`${code}: \`${span}\` is not a ${nameClass.kind} the server has`]
      : []
  })

const isOnlyNothingToAsk = (lines) => {
  const written = lines.map((line) => line.trim()).filter((line) => line !== '')
  return written.length === 1 && written[0] === NOTHING_TO_ASK
}

/**
 * The destructive tools a guide's repair calls when "Ask the user first" is only `None.`:
 * removing or dropping work needs a question for the user.
 */
export const unaskedDestructiveProblems = (code, text) => {
  const found = findSections(text)
  const repair = sectionNamed(found, REPAIR_HEADING).body.join('\n')
  const ask = sectionNamed(found, ASK_HEADING).body
  if (!isOnlyNothingToAsk(ask)) return []
  return DESTRUCTIVE_TOOLS.filter((tool) => new RegExp(`\\b${tool}\\b`).test(repair)).map(
    (tool) =>
      `${code}: the repair calls \`${tool}\` but "${ASK_HEADING}" is only ${NOTHING_TO_ASK}`,
  )
}
