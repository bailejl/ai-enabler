import { isProtoRef } from './proto-push-guard.js'

// git accepts any unambiguous abbreviation of a long option, so match a truncated prefix.
const NO_VERIFY_PREFIX = '--no-ver'
const REPO_OPTION = '--repo'
const DELETE_FLAGS = ['--delete', '-d']
const GIT_VALUE_OPTIONS = ['-C', '-c']
const OPTION_PREFIX = '-'
const REFSPEC_SEPARATOR = ':'

const WHITESPACE_PATTERN = /\s+/
const ASSIGNMENT_PATTERN = /^[A-Za-z_]\w*=/
const SEGMENT_SEPARATOR_PATTERN = /&&|\|\||\|&|[|;&\n]/
const GROUPING_PATTERN = /^[\s({!]+|[\s)}]+$/g

// One left-to-right scan; at each position the first alternative that matches wins, so quotes and
// $(( )) hide any `<<` inside them and only a heredoc opener outside them starts a heredoc.
// Alternatives: line continuation, escaped char, 'single', "double", $((arithmetic)), then
// <<WORD / <<'WORD' / <<"WORD" / <<-WORD / <<\WORD (not <<<) with the rest of its line (`rest`)
// kept and its body removed through the terminator line, or to the end if unterminated.
const TOKEN_PATTERN = new RegExp(
  [
    String.raw`\\\n`,
    String.raw`\\[\s\S]`,
    String.raw`'[^']*'`,
    String.raw`"(?:[^"\\]|\\[\s\S])*"`,
    String.raw`\$\(\([\s\S]*?\)\)`,
    String.raw`(?<!<)<<(?!<)-?[ \t]*(?<quote>['"]?)\\?(?<word>\w+)\k<quote>(?<rest>[^\n]*)` +
      String.raw`(?:\n(?:[\s\S]*?\n)?[ \t]*\k<word>[ \t]*(?=\n|$)|[\s\S]*$)`,
  ].join('|'),
  'g',
)

const NO_VERIFY_REASON =
  'Blocked: git push --no-verify skips the proto push guard. ' +
  'Prototype branches stay local; use /prototype graduate.'
const protoRefReason = (ref) =>
  `Blocked: this push would leak the prototype branch ${ref}. ` +
  'Prototype branches stay local; use /prototype graduate.'

const replaceToken = (token, ...captures) => {
  const { rest } = captures.at(-1)
  if (rest !== undefined) return stripNonCommandText(rest)
  return token.startsWith('\\') && token !== '\\\n' ? '' : ' '
}

const stripNonCommandText = (command) => command.replace(TOKEN_PATTERN, replaceToken)

const splitSegments = (command) => command.split(SEGMENT_SEPARATOR_PATTERN)

const wordsOf = (segment) => segment.replace(GROUPING_PATTERN, '').split(WHITESPACE_PATTERN)

const dropFrom = (words, isLeading) => {
  const start = words.findIndex((word, index) => !isLeading(word, index))
  return start === -1 ? [] : words.slice(start)
}

const skipAssignments = (words) => dropFrom(words, (word) => ASSIGNMENT_PATTERN.test(word))

const skipGitGlobalOptions = (words) =>
  dropFrom(
    words,
    (word, index) =>
      GIT_VALUE_OPTIONS.includes(word) || GIT_VALUE_OPTIONS.includes(words[index - 1]),
  )

// Words after `git push` when the segment is a plain push, else null.
const argsAfterPush = (segment) => {
  const afterEnv = skipAssignments(wordsOf(segment))
  if (afterEnv[0] !== 'git') return null
  const afterOptions = skipGitGlobalOptions(afterEnv.slice(1))
  return afterOptions[0] === 'push' ? afterOptions.slice(1) : null
}

const usesNoVerify = (args) => args.some((arg) => arg.startsWith(NO_VERIFY_PREFIX))

const isDeleteMode = (args) => args.some((arg) => DELETE_FLAGS.includes(arg))

const namesRepoOption = (arg) => arg === REPO_OPTION || arg.startsWith(`${REPO_OPTION}=`)

// The first positional word is the remote, unless --repo names it; refspecs follow.
const refspecsOf = (args) => {
  const positional = args.filter(
    (arg, index) => !arg.startsWith(OPTION_PREFIX) && args[index - 1] !== REPO_OPTION,
  )
  return args.some(namesRepoOption) ? positional : positional.slice(1)
}

const isDeleteRefspec = (refspec) => refspec.startsWith(REFSPEC_SEPARATOR)

const protoRefIn = (refspec) => refspec.split(REFSPEC_SEPARATOR).find(isProtoRef)

const findProtoRef = (args) =>
  isDeleteMode(args)
    ? undefined
    : refspecsOf(args)
        .filter((refspec) => !isDeleteRefspec(refspec))
        .map(protoRefIn)
        .find((protoRef) => protoRef !== undefined)

const segmentReason = (segment) => {
  const args = argsAfterPush(segment)
  if (args === null) return null
  if (usesNoVerify(args)) return NO_VERIFY_REASON
  const protoRef = findProtoRef(args)
  return protoRef === undefined ? null : protoRefReason(protoRef)
}

export const blockReason = (command) =>
  splitSegments(stripNonCommandText(command))
    .map(segmentReason)
    .find((reason) => reason !== null) ?? null
