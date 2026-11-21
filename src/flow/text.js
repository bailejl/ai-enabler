// User text echoed into a message or summary is cut to this many characters, so a huge title or id
// cannot flood a result. The full text stays in `untrusted`.
export const MAX_ECHOED_TEXT = 80

// String() throws on an object whose toString is not a function, or that has none.
const toText = (value) => {
  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

export const shorten = (value) => {
  const text = toText(value)
  return text.length > MAX_ECHOED_TEXT ? `${text.slice(0, MAX_ECHOED_TEXT - 1)}…` : text
}

export const quoted = (value) => `"${shorten(value)}"`

export const formatCount = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
