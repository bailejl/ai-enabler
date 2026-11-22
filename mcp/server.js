import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { Protocol } from '@modelcontextprotocol/sdk/shared/protocol.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { GUIDES } from './guideSource.js'
import { createStore } from './store.js'
import { SERVER_NAME, TOOLS, createToolHost, toCallResult } from './tools.js'

const SERVER_INFO = { name: SERVER_NAME, version: '0.1.0' }

// A closed stderr pipe reports its error later, as an event; it must not take the server down.
process.stderr.on('error', () => {})

// Stdout is the protocol channel, so the log goes to stderr. The host survives a log that throws.
const log = (line) => process.stderr.write(`${line}\n`)

const host = createToolHost({
  store: createStore(process.cwd()),
  now: () => new Date(),
  newId: () => randomUUID().replaceAll('-', '').slice(0, 12),
  log,
  guides: GUIDES,
})

// The host checks every argument itself, so the SDK does no validation of its own.
const server = new Server(SERVER_INFO, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }))

const CallToolAnyArguments = z.object({
  method: z.literal('tools/call'),
  params: z.looseObject({ name: z.string(), arguments: z.unknown().optional() }),
})

// The SDK's Server re-checks every tools/call against its own schema, which only admits an object
// for `arguments`, before any handler runs. Registering through the base class skips that check, so
// our schema decides and the host answers a non-object `arguments` with a problem result.
Protocol.prototype.setRequestHandler.call(server, CallToolAnyArguments, async ({ params }) => {
  return toCallResult(await host.callTool(params.name, params.arguments))
})

await server.connect(new StdioServerTransport())
