import { isProtoRef } from './proto-push-guard.js'

const NO_VERIFY_PREFIX = '--no-ver'
const ASSIGNMENT_PATTERN = /^[A-Za-z_]\w*=/
const GIT_CONFIG_FLAGS = ['-C', '-c']
const SEGMENT_SEPARATOR = /&&|\|\||;|\||\n/
const QUOTED_STRING = /'[^']*'|"(?:[^"\\]|\\.)*"/g
// <<WORD, <<'WORD', <<-WORD (not <<<) through its terminator line, or to the end if unterminated.
const HEREDOC =
  /(?<!<)<<-?\s*(['"]?)(\w+)\1([^\n]*)(?:\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*(?=\n|$)|[\s\S]*$)/g

const NO_VERIFY_REASON =
  'Blocked: git push --no-verify skips the proto push guard. ' +
  'Prototype branches stay local; use /prototype graduate.'
const protoRefReason = (ref) =>
  `Blocked: this push would leak the prototype branch ${ref}. ` +
  'Prototype branches stay local; use /prototype graduate.'

const stripHeredocs = (command) => command.replace(HEREDOC, '$3')

const stripQuotedStrings = (command) => command.replace(QUOTED_STRING, ' ')

const splitSegments = (command) => command.split(SEGMENT_SEPARATOR)

const skipAssignments = (words) =>
  ASSIGNMENT_PATTERN.test(words[0]) ? skipAssignments(words.slice(1)) : words

const skipGitConfig = (words) =>
  GIT_CONFIG_FLAGS.includes(words[0]) ? skipGitConfig(words.slice(2)) : words

// Words after `git push` when the segment is a plain push, else null.
const pushArgs = (segment) => {
  const afterEnv = skipAssignments(segment.trim().split(/\s+/))
  if (afterEnv[0] !== 'git') return null
  const afterConfig = skipGitConfig(afterEnv.slice(1))
  return afterConfig[0] === 'push' ? afterConfig.slice(1) : null
}

const usesNoVerify = (args) => args.some((arg) => arg.startsWith(NO_VERIFY_PREFIX))

const isDeleteMode = (args) => args.includes('--delete') || args.includes('-d')

// The first non-option word is the remote; refspecs follow it.
const refspecsOf = (args) => args.filter((arg) => !arg.startsWith('-')).slice(1)

const isDeleteRefspec = (refspec) => refspec.startsWith(':')

const protoSideOf = (refspec) => refspec.split(':').find(isProtoRef)

const findProtoRefspecSide = (args) =>
  isDeleteMode(args)
    ? undefined
    : refspecsOf(args)
        .filter((refspec) => !isDeleteRefspec(refspec))
        .map(protoSideOf)
        .find((side) => side !== undefined)

const segmentReason = (segment) => {
  const args = pushArgs(segment)
  if (args === null) return null
  if (usesNoVerify(args)) return NO_VERIFY_REASON
  const protoSide = findProtoRefspecSide(args)
  return protoSide === undefined ? null : protoRefReason(protoSide)
}

export const blockReason = (command) =>
  splitSegments(stripQuotedStrings(stripHeredocs(command)))
    .map(segmentReason)
    .find((reason) => reason !== null) ?? null
