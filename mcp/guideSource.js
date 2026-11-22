import { readGuides } from '../src/flow/diagnostics/readGuides.js'

// The repair guides, read from their files. The plugin build replaces this module with the same
// map as JSON (see `vite.mcp.config.js`), so the bundle needs no guides folder.
export const GUIDES = readGuides(new URL('../src/flow/diagnostics/guides/', import.meta.url))
