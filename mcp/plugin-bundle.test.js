import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, describe, expect, it } from 'vitest'
import { TOOLS } from './tools.js'

const BUNDLE = fileURLToPath(new URL('../plugin/server/aie-mcp.js', import.meta.url))

// Each test spawns a Node child over stdio, so it gets more than vitest's 5s default.
const SPAWN_TIMEOUT_MS = 20_000

const cleanups = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

// Copies only the bundle into an empty folder under os.tmpdir(), outside the repo, so nothing can
// resolve from the repo's node_modules, and connects an SDK client to it over stdio.
const startBundle = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aie-bundle-'))
  const client = new Client({ name: 'bundle-test', version: '0.0.0' })
  cleanups.push(async () => {
    try {
      await client.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  const file = path.join(dir, 'aie-mcp.js')
  await copyFile(BUNDLE, file)
  const transport = new StdioClientTransport({ command: process.execPath, args: [file], cwd: dir })
  await client.connect(transport)
  return client
}

describe('the bundled server', () => {
  it(
    'runs on its own and lists the full tool list',
    async () => {
      const client = await startBundle()

      const { tools } = await client.listTools()

      expect(tools.map(({ name }) => name).sort()).toEqual(TOOLS.map(({ name }) => name).sort())
    },
    SPAWN_TIMEOUT_MS,
  )

  it(
    'answers a tools/call whose arguments are not an object with a problem result',
    async () => {
      const client = await startBundle()

      const result = await client.request(
        { method: 'tools/call', params: { name: 'add_step', arguments: 5 } },
        CallToolResultSchema,
      )

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).problems.length).toBeGreaterThan(0)
    },
    SPAWN_TIMEOUT_MS,
  )
})
