// User text echoed into a message or summary is cut to this many characters, so a huge title or id
// cannot flood a result. The full text stays in `untrusted`.
export const MAX_ECHOED_TEXT = 80

export const shorten = (value) => {
  const text = String(value)
  return text.length > MAX_ECHOED_TEXT ? `${text.slice(0, MAX_ECHOED_TEXT - 1)}…` : text
}
