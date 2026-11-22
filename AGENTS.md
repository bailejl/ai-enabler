# AGENTS.md

AI Enabler draws and calculates value stream maps. This file is for AI agents working with a project file or in this repo.

## Working with a project file

Read [llms.txt](public/llms.txt) first. It is the single source for the file format, every field with its meaning and unit, the MCP tools, the gates and the rules the JSON Schema cannot express. It is served at <https://bailejl.github.io/ai-enabler/llms.txt>, with the JSON Schema beside it at `/schema/project-0.1.0.json`.

## Working in this repo

The conventions are in [.claude/CLAUDE.md](.claude/CLAUDE.md). In short:

- Stack: JavaScript ES modules, Node 24, npm; React 19 and React Flow on Vite. Functional style, no classes.
- Commands: `npm test`, `npm run lint`, `npm run lint:deep`, `npm run format:check`, `npm run build`.
- Value stream logic lives in plain functions under `src/flow/`, with colocated Vitest tests.
- `mcp/` may import `src/flow/` only; `src/` never imports `mcp/`.
- A change that adds a save-file field also adds its command, MCP tool and `llms.txt` entry.
