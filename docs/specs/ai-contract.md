<!-- spec-version: 14.2.0 -->

# Spec: AI-driven VSM building through a local MCP server

Sources: [#24 E13](https://github.com/bailejl/ai-enabler/issues/24) and the requirements doc [AI-Driven VSM Building: Requirements](https://claude.ai/artifact/2MCD4LvxsfsTacq9KL2yHo) (R1–R12, S1–S5). Decisions made with the stakeholder on 2026-11-17 and 2026-11-21 are marked **Q**. This version replaces the earlier CLI-based draft.

## Intent Description

Today an AI can build a VSM only by writing the whole project file and importing it. The app's validator stops at the first error, so a large VSM takes many slow round trips. This change gives Claude Code a local MCP server that applies one small, validated change at a time, through the same pure rules the app enforces, and returns every problem with that change right away.

Claude can create a project or open an existing one, edit it with commands, and save it. The server lays out the steps for human readability after every change, and marks the file as changed by AI tools. A human then imports the file into the GitHub Pages app to review it, and the app validates it again. The app stays a static site with no backend.

The server ships in a Claude Code plugin from this repo, together with the `aie-guide` and `aie-review` skills, a JSON Schema for the file, `llms.txt` and `AGENTS.md`.

## Architecture Specification

**Scope**

- In: the full-problem validator (R1, R2), the command layer (R3), the MCP server (R5, R6, R9), export with the MCP mark (R7, schema 0.1.0), auto-layout (R10), the JSON Schema, `llms.txt` and `AGENTS.md` (R11), the skills and plugin (R12), and security rules S1–S5.
- Out: claude.ai web and desktop clients, any hosted API, the app calling GitHub, Jira, Linear or DX, how Claude gets source data, live sync with an open browser tab, and WebMCP (later phase).
- Out, its own item: the React UI editing through the command layer (former R4).
- Out, follow-up issues from #24: File System Access autosave with the "Reload changes" banner and "copy for AI", and `window.aie` with `data-testid`s.

**Components**

- `src/flow/schema/validate.js` returns every problem, not just the first. Each problem has a `code`, a `message`, and a `stepId` or `edgeId` when it concerns one item. Import (`src/flow/importFile.js`, `src/flow/importFlow.js`) lists every problem.
- Command layer: pure functions under `src/flow/commands/`. Each takes a project and arguments and returns `{ ok, project, problems, summary }`. A rejected command returns the input project unchanged.
- Gate checks: a pure registry under `src/flow/gates/`, keyed by gate id, with `data-complete` as the first check (Q gate checks, 2026-11-17).
- Layout: a pure, deterministic function under `src/flow/` that positions steps left to right in flow order. The session runs it when `save_project` writes the file. The layout algorithm is a `/plan` decision.
- MCP server: a new top-level `mcp/` folder (Q server home). It may import the pure modules in `src/flow/`, never React or `src/shell/`. It is a thin stdio adapter: one tool per command, plus `get_project`, `list_problems` (with an optional gate id) and `save_project`. It is excluded from coverage and mutation like the CLIs, and the logic it calls is tested in `src/flow/`.
- Projects folder: `./projects`, resolved from the server's working directory at start (Q projects dir). Files are opened and saved by name only.
- Schema 0.1.0 adds an optional top-level `modifiedBy: { tool: "aie-mcp", at: <ISO time> }`. The upgrade from 0.0.0 is an identity hop, with a new fixture, per `docs/schema-versioning.md`.
- App: import shows "Changed by AI tools" for a file with a valid hash and a `modifiedBy` mark, in place of `EDITED_NOTICE`. The app's own export omits `modifiedBy`.
- JSON Schema: `public/schema/project-0.1.0.json`, also copied into the plugin. Rules that JSON Schema cannot express (loops, duplicate ids, missing endpoints) are listed in `llms.txt`.
- Plugin: a Claude Code plugin and marketplace manifest in this repo. It holds the MCP server registration, `aie-guide` and `aie-review`. It runs with Node 24 and needs no `npm install` by the user. How the server is bundled is a `/plan` decision.
- Docs: `llms.txt` at the site root for a user's AI, and `AGENTS.md` at the repo root, which links to `llms.txt` and states the repo conventions. CLAUDE.md gains the `mcp/` import rule.

**Constraints**

- Follow CLAUDE.md: functional ES modules, pure logic in `src/flow/`, Vitest colocated tests, Prettier and oxlint.
- Only the server's own behavior is tested. Claude Code settings, account choice and model behavior are not (Q, 2026-11-21).
- The app's calculations win over a skill's. Skills report the app's numbers.

## Acceptance Criteria

Citations: **R**/**S** = requirements doc row, **Q** = stakeholder decision, **inference** = logged in the Ambiguity Log.

1. **Every problem.** `validateProjectFile` on a file with three different problems returns all three, each with a `code` and a readable `message`. A valid file returns `{ ok: true, problems: [] }`. (R1)
2. **Import lists every problem.** The app still accepts valid files, and for an invalid file it shows every problem, not just the first. (R2)
3. **Commands.** These commands exist: create project, add step, update step, remove step, connect, disconnect, and set step metrics (`pt`, `lt`, `ca`, `queue`, `batch`). Each returns the new project, every problem, and a one-line summary. (R3, R6)
4. **Rejected commands change nothing.** A command that would leave the project invalid returns `ok: false` with its problems, and the project is unchanged. For example, connecting a step to itself or adding a negative `pt`. (R3)
5. **Removing a step removes its connections.** Removing a step also removes every connection to or from it, and the summary says how many. (inference)
6. **MCP tools.** The server offers one tool per command plus `open_project`, `save_project`, `discard_changes`, `get_project` and `list_problems`, over stdio. A rejected call sets MCP `isError`. Claude Code can register it with `claude mcp add` and build a VSM from an empty project using only these tools. (R5)
7. **Result shape.** Every tool result has `ok`, `problems[]` and `summary`. A failed call's problems name the step or connection and the field, so a follow-up call can fix the mistake. (R6)
8. **Open, edit, save.** Opening a file the app exported, changing one step's metrics and saving produces a file that the app imports with only that change, plus the layout and the `modifiedBy` mark. (R9)
9. **Save is explicit.** Changes are written to disk only by `save_project`. Opening another file while there are unsaved changes returns a problem and doesn't switch files. (inference)
10. **Names only.** Open and save take a file name without a path. A name with a path separator, `..`, or one that resolves outside `./projects` (including through a symlink) is rejected with a problem, and nothing is read or written. (S1, S2)
11. **No other capabilities.** The server offers no tool that runs a shell, makes a network call or takes a file path. (S1)
12. **Layout.** In every file `save_project` writes, no two steps overlap, and every connection points from left to right. The same project and change always give the same positions. Commands do not accept positions. (R10)
13. **Humans can still drag.** A position a human sets in the app is kept on the app's export. The next MCP save lays the map out again. (R10; Q layout)
14. **MCP mark.** `save_project` writes a schema 0.1.0 file with a valid `contentHash` and `modifiedBy: { tool: "aie-mcp", at }`. (R7)
15. **App notice.** Importing that file shows "Changed by AI tools" and not the "changed outside AI Enabler" notice. A file whose hash does not match still shows the edited notice. When a human exports from the app, the file has no `modifiedBy`. (R7; S4)
16. **Schema bump.** Schema 0.1.0 has a fixture, an upgrade hop from 0.0.0, and updated shape and fixture checks. Every 0.0.0 fixture still imports. (R7; `docs/schema-versioning.md`)
17. **App validates again.** The app validates every imported file, whatever its mark. (S4)
18. **Command log.** The server writes one line to stderr for each command it applies, with the command name and the summary. Stdout carries only MCP protocol messages. (S5; inference)
19. **"Data complete" gate.** `list_problems` with gate `data-complete` returns one problem for each step missing `pt`, `lt`, `ca` or `queue`, naming the missing fields. A new gate is added by registering one pure function. (Q gate checks, 2026-11-17)
20. **JSON Schema and docs.** Every released fixture passes the JSON Schema. `llms.txt` is served at the site root and lists every MCP tool, each field's meaning and unit, and every rule the schema cannot express. `AGENTS.md` links to it. (R11)
21. **Plugin.** Installing the plugin from the marketplace registers the MCP server and both skills. `aie-guide` teaches the conventions in `llms.txt` and checks the file's `schemaVersion`. `aie-review` reports `list_problems` results without changing them. (R12)
22. **Tests.** The command layer, gate checks, layout and validator have colocated Vitest tests, and coverage and mutation checks pass at the current bar. (R8)
23. **Save-file parity.** Every writable field in the JSON Schema can be set by some command. Only `schemaVersion`, `contentHash`, `exportedAt`, `modifiedBy`, ids and positions are exempt. A test fails when a schema field has no command. A Definition of Done rule in `CLAUDE.md` and the product plan says a change that adds a save-file field also adds its command, tool and `llms.txt` entry. (Q sync, 2026-11-21)
24. **Diagnostics catalog.** Every problem from validation, commands, gates and the server comes from one catalog file through one helper. Each has a stable, area-prefixed code, a severity, a one-line message and a one-line fix, and user text sits in a marked `untrusted` field. A test fails on any code not in the catalog. (Logging for AI Agents spec MSG-01–06, CAT-01–04, UPK-01; Q 2026-11-21)

## Glossary

| Term            | Definition                                                                               | Status       | Source                         |
| --------------- | ---------------------------------------------------------------------------------------- | ------------ | ------------------------------ |
| Project file    | The JSON file AIE exports and imports, schema 0.1.0 after this change                    | `verified`   | `docs/schema-versioning.md`, Q |
| Step            | A node of type `step`, called a "box" in the plan                                        | `unverified` | `src/flow/step.js`             |
| Command         | A pure function that applies one change and returns the project, problems and a summary  | `verified`   | R3                             |
| Problem         | One finding from validation or a gate: code, message, and optional step or connection id | `unverified` | R1, R6                         |
| MCP mark        | The top-level `modifiedBy` field that `save_project` writes                              | `verified`   | R7, Q                          |
| Projects folder | `./projects` in the server's working directory                                           | `verified`   | Q projects dir                 |
| Data complete   | Every step has `pt`, `lt`, `ca` and `queue`                                              | `unverified` | plan Phase 1 gate              |

## Ambiguity Log

| Decision                                                  | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI client and transport                                   | `requires-stakeholder-input` | human       | Claude Code only, local stdio MCP server. Replaces the earlier CLI                                                                                                                                                                                            |
| How the app treats MCP-changed files                      | `requires-stakeholder-input` | human       | Valid hash plus `modifiedBy`. Notice "Changed by AI tools"; dropped on a human's export                                                                                                                                                                       |
| Editing existing VSMs                                     | `requires-stakeholder-input` | human       | Required. Open and save by name inside one fixed folder                                                                                                                                                                                                       |
| Layout enforcement                                        | `requires-stakeholder-input` | human       | Auto-layout when the MCP server saves (changed on 2026-11-21: the server cannot see the map, so layout runs once on save); humans can still drag in the app                                                                                                   |
| Keeping MCP in sync with the app                          | `requires-stakeholder-input` | human       | Only the save file matters, not in-app calculations. A parity test plus a Definition of Done rule (AC23)                                                                                                                                                      |
| Former R4 (UI through the command layer)                  | `requires-stakeholder-input` | human       | Split into its own item                                                                                                                                                                                                                                       |
| R6 meaning                                                | `requires-stakeholder-input` | human       | Claude can fix a mistake in a follow-up call, not within one call                                                                                                                                                                                             |
| Former S3 and S7 (Claude Code settings, approved account) | `requires-stakeholder-input` | human       | Dropped. They test Claude Code, not this system                                                                                                                                                                                                               |
| CLI, JSON Schema, docs, skills from the earlier draft     | `requires-stakeholder-input` | human       | Drop the CLI. Keep the JSON Schema, `llms.txt`, `AGENTS.md` and both skills                                                                                                                                                                                   |
| Server location                                           | `requires-stakeholder-input` | human       | New top-level `mcp/`, which may import the pure modules in `src/flow/`                                                                                                                                                                                        |
| Projects folder location                                  | `requires-stakeholder-input` | human       | `./projects` in the directory where Claude Code runs                                                                                                                                                                                                          |
| Explicit save vs. autosave (AC9)                          | `inferable`                  | inference   | R9 says "save it back", which names a save step. Check passed: autosave on every command is ruled out by R9's separate save                                                                                                                                   |
| Removing a step removes its connections (AC5)             | `inferable`                  | inference   | A connection to a missing step fails validation, so leaving it would reject every remove. Check passed: "reject removal while connected" is plausible, but it contradicts R3's one-change-at-a-time goal by forcing extra calls. Flag in plan review if wrong |
| Log goes to stderr (AC18)                                 | `inferable`                  | inference   | Stdio MCP uses stdout for protocol messages. No plausible alternative                                                                                                                                                                                         |
| Name rules for open and save (AC10)                       | `inferable`                  | inference   | S2 says "one fixed folder". Rejecting separators, `..` and symlink escapes is the minimum that enforces it. No plausible alternative                                                                                                                          |
| Mismatched hash with an MCP mark                          | `inferable`                  | inference   | A hash mismatch means a later edit outside both tools, so the edited notice wins (AC15). Check passed: "trust the mark" would hide that edit, against S4                                                                                                      |
| Human drags are lost on the next MCP save (AC13)          | `inferable`                  | inference   | Follows from auto-layout on every MCP save. Check passed: "keep human positions" contradicts R10's enforced layout                                                                                                                                            |
| Delete of a project file                                  | `inferable`                  | inference   | Not offered. The server has no delete tool; users delete files themselves. Not needed for building or editing                                                                                                                                                 |
| Authentication and authorization                          | `inferable`                  | inference   | Not applicable. A local stdio process started by the user's Claude Code, no network port                                                                                                                                                                      |
| Error when the projects folder is missing or unwritable   | `inferable`                  | inference   | `save_project` creates `./projects` if missing. An unwritable folder returns a problem, and the project stays in memory                                                                                                                                       |
| "Step" vs. the plan's "box"                               | `inferable`                  | inference   | The code says "step"; `llms.txt` says both mean the same thing                                                                                                                                                                                                |

Entities enumerated for the completeness sweep: project file, step, connection, command, problem, gate check, MCP mark, projects folder, plugin, skill.

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged: inferable with rationale or resolved by human
