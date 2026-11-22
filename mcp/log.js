// A line of stderr is one line: control characters (a newline in a step name) are written out.
const SHORT_ESCAPES = { '\n': '\\n', '\r': '\\r', '\t': '\\t' }

/** The text with every control character written out, so it stays on one log line. */
export const escapeControls = (text) =>
  text.replace(
    /[\p{Cc}\u2028\u2029]/gu,
    (char) => SHORT_ESCAPES[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
