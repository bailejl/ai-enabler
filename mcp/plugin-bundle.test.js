import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, onTestFinished } from 'vitest'
import { CATALOG_CODES } from '../src/flow/diagnostics/problem.js'
import { TOOLS } from './tools.js'

const BUNDLE = fileURLToPath(new URL('../plugin/server/aie-mcp.js', import.meta.url))
const GUIDES_FOLDER = new URL('../src/flow/diagnostics/guides/', import.meta.url)

// Each test spawns a Node child over stdio, so it gets more than vitest's 5s default.
const SPAWN_TIMEOUT_MS = 20_000

// Copies only the bundle into an empty folder under os.tmpdir(), outside the repo, so nothing can
// resolve from the repo's node_modules, and connects an SDK client to it over stdio. Returns the
// client and the cleanup that closes it and removes the folder.
const startBundle = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aie-bundle-'))
  const client = new Client({ name: 'bundle-test', version: '0.0.0' })
  const cleanup = async () => {
    try {
      await client.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
  try {
    const file = path.join(dir, 'aie-mcp.js')
    await copyFile(BUNDLE, file)
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [file], cwd: dir }),
    )
  } catch (error) {
    await cleanup()
    throw error
  }
  return { client, cleanup }
}

describe('the bundled server', () => {
  it(
    'runs on its own and lists the full tool list',
    async () => {
      const { client, cleanup } = await startBundle()
      onTestFinished(cleanup)

      const { tools } = await client.listTools()

      expect(tools.map(({ name }) => name).sort()).toEqual(TOOLS.map(({ name }) => name).sort())
    },
    SPAWN_TIMEOUT_MS,
  )

  it(
    'answers a tools/call whose arguments are not an object with a problem result',
    async () => {
      const { client, cleanup } = await startBundle()
      onTestFinished(cleanup)

      const result = await client.request(
        { method: 'tools/call', params: { name: 'add_step', arguments: 5 } },
        CallToolResultSchema,
      )

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).problems.length).toBeGreaterThan(0)
    },
    SPAWN_TIMEOUT_MS,
  )

  it(
    'serves for every catalog code the same guide text as its source file',
    async () => {
      const { client, cleanup } = await startBundle()
      onTestFinished(cleanup)

      const served = {}
      for (const code of CATALOG_CODES) {
        const result = await client.callTool({ name: 'get_repair_guide', arguments: { code } })
        expect(result.isError, code).toBe(false)
        served[code] = result.structuredContent.guide
      }

      const expected = Object.fromEntries(
        await Promise.all(
          CATALOG_CODES.map(async (code) => [
            code,
            await readFile(new URL(`${code}.md`, GUIDES_FOLDER), 'utf8'),
          ]),
        ),
      )
      expect(served).toEqual(expected)
    },
    SPAWN_TIMEOUT_MS,
  )

  it(
    'refuses a code that is not a catalog code with CMD_CODE_UNKNOWN',
    async () => {
      const { client, cleanup } = await startBundle()
      onTestFinished(cleanup)

      const result = await client.callTool({
        name: 'get_repair_guide',
        arguments: { code: 'CONN_NOPE' },
      })

      expect(result.isError).toBe(true)
      expect(result.structuredContent.problems.map(({ code }) => code)).toEqual([
        'CMD_CODE_UNKNOWN',
      ])
      expect(result.structuredContent).not.toHaveProperty('guide')
    },
    SPAWN_TIMEOUT_MS,
  )
})
