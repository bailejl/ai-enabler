import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createStore } from './store.js'
import { TOOLS, createToolHost, toCallResult } from './tools.js'

const SERVER_INFO = { name: 'aie-mcp', version: '0.1.0' }

// A closed stderr pipe reports its error later, as an event; it must not take the server down.
process.stderr.on('error', () => {})

// Stdout is the protocol channel, so the log goes to stderr. The host survives a log that throws.
const log = (line) => process.stderr.write(`${line}\n`)

const host = createToolHost({
  store: createStore(process.cwd()),
  now: () => new Date(),
  newId: () => randomUUID().replaceAll('-', '').slice(0, 12),
  log,
})

// The host checks every argument itself, so the SDK does no validation of its own.
const server = new Server(SERVER_INFO, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  return toCallResult(await host.callTool(params.name, params.arguments))
})

await server.connect(new StdioServerTransport())
