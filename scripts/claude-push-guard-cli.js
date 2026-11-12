import { readFileSync } from 'node:fs'
import { readHookBlockReason } from './claude-push-guard.js'

const HOOK_BLOCK_EXIT_CODE = 2 // exit 2 blocks the tool call in Claude Code
const reason = readHookBlockReason(() => readFileSync(0, 'utf8'))
if (reason !== null) {
  process.stderr.write(`${reason}\n`)
  process.exitCode = HOOK_BLOCK_EXIT_CODE
}
