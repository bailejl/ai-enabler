import { describe, expect, test } from 'vitest'
import { blockReason } from './claude-push-guard.js'

describe('blockReason: proto refspecs', () => {
  test.each([
    ['git push origin proto/canvas-zoom', 'proto/canvas-zoom'],
    ['git push origin proto/canvas-zoom:main', 'proto/canvas-zoom'],
    ['git push origin feat/a:proto/b', 'proto/b'],
    ['git push origin +proto/x', 'proto/x'],
    ['git push origin HEAD:refs/heads/proto/x', 'refs/heads/proto/x'],
    ['git -C ../repo push origin proto/x', 'proto/x'],
    ['git push origin :proto/old proto/new', 'proto/new'],
    ['git push origin refs/heads/proto/a/b', 'proto/a/b'],
    ['git push origin feat/a && git push origin proto/z', 'proto/z'],
  ])('blocks %s naming the ref', (command, ref) => {
    expect(blockReason(command)).toContain(ref)
  })

  test('points to /prototype graduate', () => {
    expect(blockReason('git push origin proto/x')).toContain('/prototype graduate')
  })

  test.each([
    ['git push origin feat/canvas-zoom'],
    ['git push origin feat/proto/x'],
    ['git push origin refs/tags/proto/v1'],
    ['git push origin prototype-notes'],
    ['git push --delete origin proto/old'],
    ['git push -d origin proto/old'],
    ['git push origin :proto/old'],
    ['git push origin'],
    ['git push'],
  ])('allows %s', (command) => {
    expect(blockReason(command)).toBeNull()
  })
})

describe('blockReason: text that only mentions a push', () => {
  test.each([
    ['echo "a && git push --no-verify"'],
    ['git commit -m "fix; git push --no-verify docs"'],
    ['git log --grep="git push --no-verify"'],
    ["echo 'git push origin proto/x'"],
    ['echo "say \\"hi\\"; git push --no-verify"'],
    ['ls proto/'],
  ])('allows %s', (command) => {
    expect(blockReason(command)).toBeNull()
  })

  test.each([
    ['git commit -F- <<EOF\ngit push --no-verify\nEOF'],
    ["git commit -F- <<'EOF'\ngit push --no-verify\nEOF"],
    ['git commit -F- <<-EOF\n\tgit push --no-verify\n\tEOF'],
    ['cat <<DOC\nit\'s a "quote\ngit push origin proto/x\nDOC'],
    ['cat <<EOF\nEOF'],
    ['cat <<EOF\ngit push --no-verify'],
  ])('ignores a heredoc body in %j', (command) => {
    expect(blockReason(command)).toBeNull()
  })

  test('still checks the command after a heredoc terminator', () => {
    expect(blockReason('cat <<EOF\nnotes\nEOF\ngit push --no-verify')).toContain('--no-verify')
  })

  test('still checks the command on the heredoc opener line', () => {
    expect(blockReason('cat <<EOF && git push --no-verify\nnotes\nEOF')).toContain('--no-verify')
  })

  test('does not treat a here-string as a heredoc', () => {
    expect(blockReason('cat <<<x; git push --no-verify')).toContain('--no-verify')
  })
})

describe('blockReason: --no-verify', () => {
  test.each([
    ['git push --no-verify'],
    ['git push origin feat/a --no-verif'],
    ['npm test && git push --no-verify origin x'],
    ['git status; git push --no-verify'],
    ['FOO=1 git push --no-verify'],
    ['git -C ../repo push --no-verify'],
    ['git status\ngit push --no-verify'],
    ['git status | git push --no-verify'],
    ['false || git push --no-verify'],
  ])('blocks %s', (command) => {
    expect(blockReason(command)).toContain('--no-verify')
  })

  test.each([
    ['git commit --no-verify -m wip'],
    ['git push origin feat/canvas-zoom'],
    ['ls'],
    [''],
  ])('allows %s', (command) => {
    expect(blockReason(command)).toBeNull()
  })
})
