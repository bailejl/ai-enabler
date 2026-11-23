// Per-test state for the unit diagnostics gate. vitest.setup.js starts a capture before each test,
// feeds it the console calls, and fails the test with the lines `finishCapture` returns. A test
// declares the codes it expects with `expectDiagnostics`; there is nothing else that lets a code
// or console text pass.

import { format } from 'node:util'
import { checkDiagnostics } from './flow/diagnostics/gate.js'
import { initialEdges, initialNodes } from './flow/initialFlow.js'
import { toMemoryProject } from './flow/projectFile.js'

let entries = []
let expected = []

/** Clears the entries and the declared codes. Called before every test. */
export const startCapture = () => {
  entries = []
  expected = []
}

/** Remembers one console call: `level` is the console method name, `args` its arguments. */
export const captureConsole = (level, args) => {
  entries = [...entries, { level, text: format(...args) }]
}

/** Declares the diagnostic codes this test expects to write. May be called more than once. */
export const expectDiagnostics = (codes) => {
  expected = [...expected, ...codes]
}

/** The failure lines for the current test, empty when it is clean. */
export const finishCapture = () => checkDiagnostics({ entries, expected })

/** The text of every console call captured so far in this test at `level` (`error`, `warn`, ...). */
export const capturedConsoleCalls = (level) =>
  entries.filter((entry) => entry.level === level).map((entry) => entry.text)

// The starter map, for tests that need a full project. The app itself starts from the store.

export const DEFAULT_PROJECT_NAME = 'Untitled Project'

export const createStarterProject = ({ newId = () => crypto.randomUUID() } = {}) => ({
  id: newId(),
  name: DEFAULT_PROJECT_NAME,
})

/**
 * The starter map as an in-memory project (`{ project, nodes, edges }`), cut to the fields a
 * project file carries: runtime fields such as `ariaLabel` are left to the canvas.
 */
export const createStarterMemoryProject = ({ newId } = {}) =>
  toMemoryProject({
    project: createStarterProject({ newId }),
    nodes: initialNodes,
    edges: initialEdges,
  })
