import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseImport } from '../src/flow/importFile.js'

const SERVER = fileURLToPath(new URL('./server.js', import.meta.url))

const TOOL_NAMES = [
  'create_project',
  'add_step',
  'update_step',
  'remove_step',
  'set_step_metrics',
  'connect',
  'disconnect',
  'open_project',
  'save_project',
  'discard_changes',
  'get_project',
  'list_problems',
]

const FORBIDDEN_INPUTS = ['path', 'file', 'dir', 'url', 'command']

const cleanups = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

// Starts `node mcp/server.js` in a fresh temp folder and speaks newline-delimited JSON-RPC to it.
// `finish()` closes its stdin, waits for it to exit and returns everything it wrote.
const startServer = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aie-server-'))
  const child = spawn(process.execPath, [SERVER], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout = []
  const pending = new Map()
  let stderr = ''
  let buffered = ''
  let nextId = 1

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffered += chunk
    const lines = buffered.split('\n')
    buffered = lines.pop()
    for (const line of lines) {
      stdout.push(line)
      const message = JSON.parse(line)
      pending.get(message.id)?.(message)
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const closed = new Promise((resolve) => child.on('close', resolve))

  cleanups.push(async () => {
    child.kill('SIGKILL')
    await closed
    await rm(dir, { recursive: true, force: true })
  })

  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`)

  const request = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      send({ jsonrpc: '2.0', id, method, params })
    })

  const call = async (name, args) => {
    const response = await request('tools/call', { name, arguments: args })
    return { ...response.result, content: JSON.parse(response.result.content[0].text) }
  }

  const initialized = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'server-test', version: '0.0.0' },
  })
  expect(initialized.result.capabilities.tools).toBeDefined()
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  const finish = async () => {
    child.stdin.end()
    await closed
    return { stdout, stderr }
  }

  return { dir, request, call, finish }
}

describe('the stdio server', () => {
  it('lists exactly the project tools, with no input that names a place', async () => {
    const { request } = await startServer()

    const { result } = await request('tools/list', {})

    expect(result.tools.map(({ name }) => name).sort()).toEqual([...TOOL_NAMES].sort())
    const inputs = result.tools.flatMap(({ inputSchema }) => Object.keys(inputSchema.properties))
    expect(inputs.filter((input) => FORBIDDEN_INPUTS.includes(input))).toEqual([])
  })

  it('builds a VSM from empty and saves a file the app imports with the AI notice', async () => {
    const { dir, call } = await startServer()

    const results = [await call('create_project', { name: 'Demo' })]
    const ids = []
    for (const name of ['Plan', 'Build', 'Ship']) {
      const added = await call('add_step', { name })
      results.push(added)
      ids.push(added.content.created)
    }
    results.push(await call('connect', { sourceId: ids[0], targetId: ids[1] }))
    results.push(await call('connect', { sourceId: ids[1], targetId: ids[2] }))
    results.push(await call('set_step_metrics', { stepId: ids[0], pt: 5, lt: 10, ca: 95 }))
    results.push(await call('save_project', { name: 'demo.json' }))

    expect(results.map(({ isError }) => isError)).toEqual(results.map(() => false))
    expect(results.at(-1).structuredContent).toEqual(results.at(-1).content)
    const imported = await parseImport(
      await readFile(path.join(dir, 'projects', 'demo.json'), 'utf8'),
    )
    expect(imported.ok).toBe(true)
    expect(imported.changedBy.tool).toBe('aie-mcp')
    expect(imported.file.nodes.map(({ data }) => data.label)).toEqual(['Plan', 'Build', 'Ship'])
    expect(imported.file.edges).toHaveLength(2)
  })

  it('refuses a path-like file name', async () => {
    const { call } = await startServer()

    const result = await call('open_project', { name: '../secret.json' })

    expect(result.isError).toBe(true)
    expect(result.content.problems.map(({ code }) => code)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it('writes one stderr line per applied command and only protocol messages to stdout', async () => {
    const { call, finish } = await startServer()

    await call('create_project', { name: 'Demo' })
    await call('add_step', { name: 'Build\nInjected' })
    const rejected = await call('add_step', {})
    const { stdout, stderr } = await finish()

    expect(rejected.isError).toBe(true)
    const lines = stderr.split('\n')
    expect(lines.pop()).toBe('')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^create_project: /)
    expect(lines[1]).toMatch(/^add_step: .*Build\\nInjected/)
    expect(stdout.length).toBeGreaterThan(0)
    for (const line of stdout) expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' })
  })
})
