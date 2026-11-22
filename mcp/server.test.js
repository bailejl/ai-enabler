import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseImport } from '../src/flow/importFile.js'
import { toProjectFile, withContentHash } from '../src/flow/projectFile.js'

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

// The text of a saved project file with one step, as the app would export it.
const savedProjectText = async () =>
  JSON.stringify(
    await withContentHash(
      toProjectFile({
        project: { id: 'p1', name: 'Saved' },
        nodes: [{ id: 'a', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Plan' } }],
        edges: [],
        now: new Date('2026-11-14T12:00:00.000Z'),
      }),
    ),
  )

const FORBIDDEN_INPUTS = ['path', 'file', 'dir', 'url', 'command']

const cleanups = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

// Starts `node mcp/server.js` in a fresh temp folder and speaks newline-delimited JSON-RPC to it.
// `finish()` closes its stdin, waits for it to exit and returns everything it wrote.
const startServer = async ({ files = {} } = {}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aie-server-'))
  await mkdir(path.join(dir, 'projects'))
  for (const [name, text] of Object.entries(files)) {
    await writeFile(path.join(dir, 'projects', name), text)
  }
  const child = spawn(process.execPath, [SERVER], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout = []
  const pending = new Map()
  const badLines = []
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
      let message
      try {
        message = JSON.parse(line)
      } catch {
        // Stdout is the protocol channel: any other text on it fails the test, with the line.
        badLines.push(line)
        const error = new Error(`The server wrote a line to stdout that is not JSON: ${line}`)
        pending.forEach(({ reject }) => reject(error))
        continue
      }
      pending.get(message.id)?.resolve(message)
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  // A server that exits or fails to start fails every call still waiting, and any later one, with
  // its exit code and what it wrote to stderr, so a crash fails fast instead of timing out.
  let exitError
  const failPending = (reason) => {
    exitError = new Error(`The server ${reason}. stderr: ${stderr}`)
    pending.forEach(({ reject }) => reject(exitError))
    pending.clear()
  }
  child.on('error', (error) => failPending(`failed: ${error.message}`))
  const closed = new Promise((resolve) =>
    child.on('close', (code, signal) => {
      failPending(`exited with code ${code} (signal ${signal})`)
      resolve()
    }),
  )

  cleanups.push(async () => {
    child.kill('SIGKILL')
    await closed
    await rm(dir, { recursive: true, force: true })
  })

  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`)

  const request = (method, params) =>
    new Promise((resolve, reject) => {
      if (exitError) return reject(exitError)
      const id = nextId++
      pending.set(id, { resolve, reject })
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
    expect(badLines, 'lines on stdout that are not JSON').toEqual([])
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
    const { call, finish } = await startServer({
      files: { 'saved.json': await savedProjectText() },
    })

    const opened = await call('open_project', { name: 'saved.json' })
    await call('add_step', { name: 'Build\nInjected' })
    const rejected = await call('add_step', {})
    const { stdout, stderr } = await finish()

    expect(opened.isError).toBe(false)
    expect(rejected.isError).toBe(true)
    const lines = stderr.split('\n')
    expect(lines.pop()).toBe('')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^add_step: .*Build\\nInjected/)
    expect(stdout.length).toBeGreaterThan(0)
    for (const line of stdout) expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' })
  })

  describe('a bad call', () => {
    it.each([
      ['an unknown tool', { name: 'nope', arguments: {} }, 'CMD_TOOL_UNKNOWN'],
      [
        'an unknown argument',
        { name: 'create_project', arguments: { name: 'Demo', path: '/etc' } },
        'CMD_ARGUMENT_UNKNOWN',
      ],
      [
        'no arguments for a tool that needs some',
        { name: 'open_project' },
        'FILE_NAME_NOT_ALLOWED',
      ],
    ])('with %s is a tool-level error', async (_label, params, code) => {
      const { request } = await startServer()

      const { result } = await request('tools/call', params)

      expect(result.isError).toBe(true)
      const content = JSON.parse(result.content[0].text)
      expect(content).toMatchObject({ ok: false, summary: expect.stringMatching(/^Rejected /) })
      expect(content.problems.map((found) => found.code)).toEqual([code])
      expect(result.structuredContent).toEqual(content)
    })

    // The server accepts any `arguments` value, so a non-object one reaches the host and gets the
    // same tool-level problem result as any other bad call, not a JSON-RPC error.
    it.each([
      ['text', 'Build'],
      ['null', null],
      ['a list', ['x']],
    ])(
      'with %s as the arguments is a tool-level error, and the server stays alive',
      async (_label, bad) => {
        const { request, call } = await startServer()
        await call('create_project', { name: 'Demo' })

        const { result } = await request('tools/call', { name: 'add_step', arguments: bad })

        expect(result.isError).toBe(true)
        const content = JSON.parse(result.content[0].text)
        expect(content).toMatchObject({ ok: false, summary: expect.stringMatching(/^Rejected /) })
        expect(content.problems.map((found) => found.code)).toEqual(['CMD_ARGUMENTS_INVALID'])
        expect(result.structuredContent).toEqual(content)
        expect((await call('get_project', {})).isError).toBe(false)
      },
    )
  })
})
