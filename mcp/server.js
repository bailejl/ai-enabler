import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createStore } from './store.js'
import { TOOLS, createToolHost } from './tools.js'

const SERVER_INFO = { name: 'aie-mcp', version: '0.1.0' }

// Stdout is the protocol channel, so the log goes to stderr. A failing log (a closed pipe) must
// not fail a call that was already applied.
const log = (line) => {
  try {
    process.stderr.write(`${line}\n`)
  } catch {
    // The call has been applied; there is nothing else to do with a log that cannot be written.
  }
}

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
  const { isError, content } = await host.callTool(params.name, params.arguments)
  return {
    content: [{ type: 'text', text: JSON.stringify(content) }],
    structuredContent: content,
    isError,
  }
})

await server.connect(new StdioServerTransport())
