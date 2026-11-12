import { readFileSync } from 'node:fs'
import { findProtoRefs, refusalMessage } from './proto-push-guard.js'

const refs = findProtoRefs(readFileSync(process.stdin.fd, 'utf8'))
if (refs.length > 0) {
  process.stderr.write(`${refusalMessage(refs)}\n`)
  process.exit(1)
}
