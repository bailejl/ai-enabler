import { readFileSync } from 'node:fs'
import { pushGuardMessage } from './proto-push-guard.js'

const message = pushGuardMessage(readFileSync(0, 'utf8'))
if (message !== null) {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
