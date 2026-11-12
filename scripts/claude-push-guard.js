import { isProtoRef } from './proto-push-guard.js'

// git accepts any unambiguous abbreviation of a long option, so match a truncated prefix.
const NO_VERIFY_PREFIX = '--no-ver'
const REPO_OPTION = '--repo'
const DELETE_FLAGS = ['--delete', '-d']
const GIT_BINARY = 'git'
const PUSH_COMMAND = 'push'
const GIT_VALUE_OPTIONS = [
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--super-prefix',
  '--exec-path',
]
const PUSH_VALUE_OPTIONS = ['-o', '--push-option', '--receive-pack', '--exec', REPO_OPTION]
const SHELL_PREFIX_WORDS = [
  'if',
  'then',
  'do',
  'else',
  'elif',
  'while',
  'until',
  'time',
  'command',
  'exec',
  'nohup',
  'env',
]
const OPTION_PREFIX = '-'
const REFSPEC_SEPARATOR = ':'
const GROUP_OPENERS = '({!'
const GROUP_CLOSERS = ')}'
// Stands in for a quoted string so it keeps its word slot (FOO="a b" stays an assignment).
const QUOTED_PLACEHOLDER = 'Q'

const WHITESPACE_PATTERN = /\s+/
const ASSIGNMENT_PATTERN = /^[A-Za-z_]\w*=/
const SEGMENT_SEPARATOR_PATTERN = /&&|\|\||\|&|[|;&\n]/

// One left-to-right scan; at each position the first alternative that matches wins, so quotes and
// $(( )) hide any `<<` or `#` inside them and only a heredoc opener or comment outside them counts.
// Alternatives: line continuation, escaped char, comment (`#` starting a word), $'ANSI-C',
// 'single', "double", $((arithmetic)), then <<WORD / <<'WORD' / <<"WORD" / <<-WORD / <<\WORD
// (not <<<) with the rest of its line (`rest`) kept and its body removed through the terminator
// line, or to the end if unterminated.
const TOKEN_PATTERN = new RegExp(
  [
    String.raw`\\\n`,
    String.raw`\\[\s\S]`,
    String.raw`(?<=^|[\s;&|()])#[^\n]*`,
    String.raw`\$'(?:[^'\\]|\\[\s\S])*'`,
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
  if (token.startsWith('\\')) return token === '\\\n' ? ' ' : ''
  if (token.startsWith('#')) return ' '
  return QUOTED_PLACEHOLDER
}

const stripNonCommandText = (command) => command.replace(TOKEN_PATTERN, replaceToken)

const splitSegments = (command) => command.split(SEGMENT_SEPARATOR_PATTERN)

// Drops leading ( { ! and trailing ) } from a word with linear scans.
const trimGrouping = (word) => {
  const chars = [...word]
  const start = chars.findIndex((char) => !GROUP_OPENERS.includes(char))
  const end = chars.findLastIndex((char) => !GROUP_CLOSERS.includes(char))
  return start === -1 ? '' : chars.slice(start, end + 1).join('')
}

const wordsOf = (segment) =>
  segment
    .trim()
    .split(WHITESPACE_PATTERN)
    .map(trimGrouping)
    .filter((word) => word !== '')

const dropFrom = (words, isLeading) => {
  const start = words.findIndex((word, index) => !isLeading(word, index))
  return start === -1 ? [] : words.slice(start)
}

const skipShellPrefix = (words) =>
  dropFrom(words, (word) => ASSIGNMENT_PATTERN.test(word) || SHELL_PREFIX_WORDS.includes(word))

const isGit = (word) => word?.split('/').at(-1) === GIT_BINARY

// Any option is skipped; an option that takes its value as a separate word also skips that word.
const skipGitGlobalOptions = (words) =>
  dropFrom(
    words,
    (word, index) => word.startsWith(OPTION_PREFIX) || GIT_VALUE_OPTIONS.includes(words[index - 1]),
  )

// Words after `git push` when the segment is a plain push, else null.
const argsAfterPush = (segment) => {
  const afterPrefix = skipShellPrefix(wordsOf(segment))
  if (!isGit(afterPrefix[0])) return null
  const afterOptions = skipGitGlobalOptions(afterPrefix.slice(1))
  return afterOptions[0] === PUSH_COMMAND ? afterOptions.slice(1) : null
}

const usesNoVerify = (args) => args.some((arg) => arg.startsWith(NO_VERIFY_PREFIX))

const withoutOptionValues = (args) =>
  args.filter((_arg, index) => !PUSH_VALUE_OPTIONS.includes(args[index - 1]))

const isDeleteMode = (args) => args.some((arg) => DELETE_FLAGS.includes(arg))

const namesRepoOption = (arg) => arg === REPO_OPTION || arg.startsWith(`${REPO_OPTION}=`)

// The first positional word is the remote, unless --repo names it; refspecs follow. git lets a
// positional argument override --repo; the guard treats them all as refspecs and errs safe.
const refspecsOf = (args, hasRepoOption) => {
  const positional = args.filter((arg) => !arg.startsWith(OPTION_PREFIX))
  return hasRepoOption ? positional : positional.slice(1)
}

const isDeleteRefspec = (refspec) => refspec.startsWith(REFSPEC_SEPARATOR)

const protoRefIn = (refspec) => refspec.split(REFSPEC_SEPARATOR).find(isProtoRef)

const findProtoRef = (args) => {
  const operands = withoutOptionValues(args)
  if (isDeleteMode(operands)) return undefined
  return refspecsOf(operands, args.some(namesRepoOption))
    .filter((refspec) => !isDeleteRefspec(refspec))
    .map(protoRefIn)
    .find((protoRef) => protoRef !== undefined)
}

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

const parseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Claude Code hook JSON in; unusable input fails open (null).
export const hookInputBlockReason = (text) => {
  const command = parseJson(text)?.tool_input?.command
  return typeof command === 'string' ? blockReason(command) : null
}
