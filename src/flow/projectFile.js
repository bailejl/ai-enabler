import { contentHash } from './contentHash.js'
import { CURRENT_SCHEMA_VERSION } from './schema/version.js'
import { STEP_DATA_FIELDS, STEP_TYPE } from './step.js'

const FALLBACK_FILE_SLUG = 'project'
const FILE_SUFFIX = '.ai-enabler.json'

// The only fields an export carries; React Flow runtime fields (selected, measured, ...) are dropped.
const PROJECT_FIELDS = ['id', 'name']
const POSITION_FIELDS = ['x', 'y']
const EDGE_FIELDS = ['id', 'source', 'target']

// Copies the listed fields that are present; absent optional fields stay absent.
const pick = (source, fields) =>
  Object.fromEntries(
    fields.filter((field) => source?.[field] !== undefined).map((f) => [f, source[f]]),
  )

// D6: an absent node type means a step, so every export names it.
export const toExportNode = (node) => ({
  id: node.id,
  type: STEP_TYPE,
  position: pick(node.position, POSITION_FIELDS),
  data: pick(node.data, STEP_DATA_FIELDS),
})

export const toExportEdge = (edge) => pick(edge, EDGE_FIELDS)

/**
 * @param {{ project: { id: string, name: string }, nodes: object[], edges: object[], now: Date }} input
 *   now is the export moment as a Date, injected so the output is deterministic.
 */
export const toProjectFile = ({ project, nodes, edges, now }) => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  exportedAt: now.toISOString(),
  project: pick(project, PROJECT_FIELDS),
  nodes: nodes.map(toExportNode),
  edges: edges.map(toExportEdge),
})

// The file as written to disk: the project file plus the hash of everything else in it.
export const withContentHash = async (file) => ({ ...file, contentHash: await contentHash(file) })

export const projectFileName = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '')
  return `${slug || FALLBACK_FILE_SLUG}${FILE_SUFFIX}`
}
