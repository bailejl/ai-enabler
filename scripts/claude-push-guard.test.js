import { describe, expect, test } from 'vitest'
import { blockReason } from './claude-push-guard.js'

const GRADUATE_HINT = '/prototype graduate'

describe('blockReason: --no-verify', () => {
  test.each([
    'git push --no-verify',
    'git push origin feat/a --no-verif',
    'npm test && git push --no-verify origin x',
    'git status; git push --no-verify',
    'FOO=1 git push --no-verify',
    'A=1 B_2=x git push --no-verify',
    'FOO="a b" git push --no-verify',
    'git -C ../repo push --no-verify',
    'git -C a -c b=c push --no-verify',
    'git status\ngit push --no-verify',
    'git status | git push --no-verify',
    'git status |& git push --no-verify',
    'git status & git push --no-verify',
    'false || git push --no-verify',
    '(git push --no-verify)',
    '{ git push --no-verify; }',
    '! git push --no-verify',
    'git push \\\n  --no-verify',
    'git  push   --no-verify',
    'git\tpush\t--no-verify',
    'git push --no-verify origin proto/x',
  ])('blocks %j naming --no-verify', (command) => {
    expect(blockReason(command)).toContain('--no-verify')
  })

  test('points to /prototype graduate', () => {
    expect(blockReason('git push --no-verify')).toContain(GRADUATE_HINT)
  })

  test.each([
    'git commit --no-verify -m wip',
    'git push --no-thin origin feat/a',
    'git push origin feat/canvas-zoom',
    'git  push   origin   feat/a',
    'ls',
    '',
  ])('allows %j', (command) => {
    expect(blockReason(command)).toBeNull()
  })
})

describe('blockReason: proto refspecs', () => {
  test.each([
    ['git push origin proto/canvas-zoom', 'proto/canvas-zoom'],
    ['git push origin proto/canvas-zoom:main', 'proto/canvas-zoom'],
    ['git push origin feat/a:proto/b', 'proto/b'],
    ['git push origin +proto/x', '+proto/x'],
    ['git push origin HEAD:refs/heads/proto/x', 'refs/heads/proto/x'],
    ['git push origin refs/heads/proto/a/b', 'refs/heads/proto/a/b'],
    ['git -C ../repo push origin proto/x', 'proto/x'],
    ['git -c core.hooksPath=x push origin proto/x', 'proto/x'],
    ['GIT_SSH=ssh git push origin proto/x', 'proto/x'],
    ['git push origin  proto/x', 'proto/x'],
    ['git push -u origin proto/x', 'proto/x'],
    ['git push --force origin proto/x', 'proto/x'],
    ['git push --repo=origin proto/x', 'proto/x'],
    ['git push --repo origin proto/x', 'proto/x'],
    ['git push origin :proto/old proto/new', 'proto/new'],
    ['git push origin feat/a && git push origin proto/z', 'proto/z'],
    ['{ git push origin proto/x; }', 'proto/x'],
    ['git push origin \\\n  proto/x', 'proto/x'],
    ['echo $((1<<2))\ngit push origin proto/x', 'proto/x'],
    ['cat <<EOF\nEOFX\nEOF\ngit push origin proto/x', 'proto/x'],
  ])('blocks %j naming the ref', (command, ref) => {
    const reason = blockReason(command)
    expect(reason).toContain(`branch ${ref}.`)
    expect(reason).toContain(GRADUATE_HINT)
  })

  test.each([
    'git push origin feat/proto/x',
    'git push origin refs/tags/proto/v1',
    'git push origin prototype-notes',
    'git push --delete origin proto/old',
    'git push -d origin proto/old',
    'git push origin :proto/old',
    'git push --repo=origin :proto/old',
    'git push origin',
    'git push',
    'git push proto/x',
    'ls proto/',
  ])('allows %j', (command) => {
    expect(blockReason(command)).toBeNull()
  })
})

describe('blockReason: text that only mentions a push', () => {
  test.each([
    'echo "a && git push --no-verify"',
    'git commit -m "fix; git push --no-verify docs"',
    'git log --grep="git push --no-verify"',
    "echo 'git push origin proto/x'",
    'echo "say \\"hi\\"; git push --no-verify"',
    'echo a\\;git push --no-verify',
  ])('allows %j', (command) => {
    expect(blockReason(command)).toBeNull()
  })

  test.each([
    'git commit -F- <<EOF\ngit push --no-verify\nEOF',
    "git commit -F- <<'EOF'\ngit push --no-verify\nEOF",
    'cat <<"EOF"\ngit push --no-verify\nEOF',
    'cat <<\\EOF\ngit push --no-verify\nEOF',
    'git commit -F- <<-EOF\n\tgit push --no-verify\n\tEOF',
    'cat <<DOC\nit\'s a "quote\ngit push origin proto/x\nDOC',
    'cat <<EOF\nEOF',
    'cat <<EOF\ngit push --no-verify',
  ])('ignores a heredoc body in %j', (command) => {
    expect(blockReason(command)).toBeNull()
  })

  test.each([
    'cat <<EOF\nnotes\nEOF\ngit push --no-verify',
    'cat <<EOF && git push --no-verify\nnotes\nEOF',
    'cat <<<x; git push --no-verify',
    'cat <<<x\ngit push --no-verify',
    'echo "a <<b"\ngit push --no-verify',
    'echo $((1<<2))\ngit push --no-verify',
    "echo don\\'t\ngit push --no-verify",
  ])('still checks the real commands in %j', (command) => {
    expect(blockReason(command)).toContain('--no-verify')
  })
})

describe('blockReason: known gaps (accepted, AC13 non-goals)', () => {
  test.each([
    'bash -c "git push --no-verify"',
    'echo $(git push --no-verify)',
    'git push origin "proto/x"',
    'git push --all',
    'git push origin HEAD',
  ])('lets %j through', (command) => {
    expect(blockReason(command)).toBeNull()
  })
})
