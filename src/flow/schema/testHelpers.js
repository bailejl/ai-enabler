// Test-only helpers shared by the schema tests. Nothing in the app imports this file.

/** A valid AI mark, as `modifiedBy` carries it. */
export const validMark = () => ({ tool: 'aie-mcp', at: '2026-11-20T09:30:00.000Z' })

/** A valid AI mark with some fields replaced. */
export const validMarkWith = (patch) => ({ ...validMark(), ...patch })

/** Where the project JSON Schema is published; the schema's `$id` and llms.txt both carry it. */
export const PUBLISHED_SCHEMA_URL = 'https://bailejl.github.io/ai-enabler/schema/project-0.1.0.json'
