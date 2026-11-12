// Keep in sync with .claude/skills/prototype
export const PROTO_PREFIX = 'refs/heads/proto/'

const HEADS_PREFIX = 'refs/heads/'
const SHORT_PROTO_PREFIX = PROTO_PREFIX.slice(HEADS_PREFIX.length)
const FORCE_MARKER = '+'
const REF_FIELD_COUNT = 4
const NULL_SHA_PATTERN = /^0+$/

export const isProtoRef = (ref) => {
  if (typeof ref !== 'string') return false
  const name = ref.startsWith(FORCE_MARKER) ? ref.slice(FORCE_MARKER.length) : ref
  return name.startsWith(PROTO_PREFIX) || name.startsWith(SHORT_PROTO_PREFIX)
}

const protoRefsOfLine = (line) => {
  const fields = line.trim().split(/\s+/)
  if (fields.length !== REF_FIELD_COUNT) return []
  const [localRef, localSha, remoteRef] = fields
  if (NULL_SHA_PATTERN.test(localSha)) return []
  return [localRef, remoteRef].filter(isProtoRef)
}

export const findProtoRefs = (input) => [...new Set(input.split('\n').flatMap(protoRefsOfLine))]

export const refusalMessage = (refs) =>
  [
    'Push refused: prototype branches stay local.',
    ...refs.map((ref) => `  - ${ref}`),
    'To share a prototype, run /prototype graduate.',
  ].join('\n')
