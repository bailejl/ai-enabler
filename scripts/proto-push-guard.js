// The /prototype skill (.claude/skills/prototype) hardcodes this branch prefix; change both together.
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

const findProtoRefsInLine = (line) => {
  const fields = line.trim().split(/\s+/)
  if (fields.length !== REF_FIELD_COUNT) return []
  const [localRef, localSha, remoteRef] = fields
  if (NULL_SHA_PATTERN.test(localSha)) return []
  return [localRef, remoteRef].filter(isProtoRef)
}

export const findProtoRefs = (input) => [...new Set(input.split('\n').flatMap(findProtoRefsInLine))]

export const refusalMessage = (protoRefs) =>
  [
    'Push refused: prototype branches stay local.',
    ...protoRefs.map((ref) => `  - ${ref}`),
    'To share a prototype, run /prototype graduate.',
  ].join('\n')

export const pushGuardMessage = (input) => {
  const protoRefs = findProtoRefs(input)
  return protoRefs.length > 0 ? refusalMessage(protoRefs) : null
}
