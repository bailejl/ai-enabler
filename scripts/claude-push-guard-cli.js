import { readFileSync } from 'node:fs'
import { hookInputBlockReason } from './claude-push-guard.js'

const reason = hookInputBlockReason(readFileSync(0, 'utf8'))
if (reason !== null) {
  process.stderr.write(`${reason}\n`)
  process.exitCode = 2
}
