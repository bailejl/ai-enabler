// A small evaluator for the subset of GitHub Actions expressions the workflows use: context
// paths, quoted strings, ==, !=, &&, || and parentheses. As on GitHub, && and || return one of
// their operands rather than a boolean, and == compares strings case-insensitively.

const TOKEN_SOURCE = String.raw`\s*(\(|\)|&&|\|\||==|!=|'[^']*'|[A-Za-z_][\w.]*)`

export const tokenize = (source, at = 0) => {
  if (source.slice(at).trim() === '') return []
  const token = new RegExp(TOKEN_SOURCE, 'y')
  token.lastIndex = at
  const match = token.exec(source)
  if (!match) throw new Error(`Unsupported expression syntax near: ${source.slice(at)}`)
  return [match[1], ...tokenize(source, token.lastIndex)]
}

const lookup = (context, path) => path.split('.').reduce((value, key) => value?.[key], context)

const fold = (value) => (typeof value === 'string' ? value.toLowerCase() : value)
const equals = (left, right) => fold(left) === fold(right)

// Each parser takes a token index and returns [value, nextIndex].
export const evaluateValue = (source, context) => {
  const tokens = tokenize(source)
  const primary = (at) => {
    const token = tokens[at]
    if (token === undefined) throw new Error('Unexpected end of expression')
    if (token === '(') {
      const [value, next] = or(at + 1)
      if (tokens[next] !== ')') throw new Error('Missing )')
      return [value, next + 1]
    }
    if (token.startsWith("'")) return [token.slice(1, -1), at + 1]
    return [lookup(context, token) ?? null, at + 1]
  }
  const comparison = (at) => {
    const [left, next] = primary(at)
    const op = tokens[next]
    if (op !== '==' && op !== '!=') return [left, next]
    const [right, after] = primary(next + 1)
    return [op === '==' ? equals(left, right) : !equals(left, right), after]
  }
  // Folds `operand (operator operand)*` left to right.
  const chain = (operator, operand, combine) => {
    const rest = (value, at) => {
      if (tokens[at] !== operator) return [value, at]
      const [right, next] = operand(at + 1)
      return rest(combine(value, right), next)
    }
    return (at) => rest(...operand(at))
  }
  const and = chain('&&', comparison, (a, b) => (a ? b : a))
  const or = chain('||', and, (a, b) => (a ? a : b))
  const [value, end] = or(0)
  if (end !== tokens.length) throw new Error(`Unparsed tokens: ${tokens.slice(end).join(' ')}`)
  return value
}

export const evaluate = (source, context) => Boolean(evaluateValue(source, context))

// Unwraps a `${{ ... }}` field, such as a concurrency group, and evaluates it.
export const evaluateTemplate = (field, context) => {
  const match = /^\$\{\{(.*)\}\}$/s.exec(field.trim())
  return match ? evaluateValue(match[1], context) : field
}
