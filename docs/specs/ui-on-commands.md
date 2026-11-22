<!-- spec-version: 14.2.0 -->

# Spec: R4 UI on commands

Source: row 6 of the MVP build order (`plans/mvp-order.md`), the "former R4" split out of the AI contract (`docs/specs/ai-contract.md`, scope), and the R4 references in the E1, E3b and D3 cards (`plans/mvp-cards.md`). No GitHub issue. Stakeholder decisions are marked **Q**. This is a refactor of existing UI behavior, so no prototype.

**Status:** gate passed 2026-11-22. The stakeholder accepted all six open decisions as recommended.

## Intent Description

Today the React UI edits the map with React Flow's own helpers: `addEdge` for a new connection and React Flow's change handlers for deletes and drags. The MCP server edits the same data through the command layer in `src/flow/commands/`, which validates every change and returns every problem. So the app and the AI follow two sets of rules, and the next UI items (E3b canvas editing, E5 undo, E1 store writes) have no single place to hook in.

This change makes every UI edit a command. Connecting, deleting and moving steps go through `applyCommand`, and the in-memory project (`{ project, nodes, edges }`) becomes the one source of truth that the canvas, the cards, the metrics bar and export all read. Behavior the user sees stays the same, except that a rejected edit is now announced and listed.

Some edits only make sense in the app, such as dragging a step to a new position. They are commands too, but they are flagged UI-only, so the MCP server never offers them as tools and the AI contract docs do not list them.

A rejected command changes nothing. It is announced in the live region and its problems are listed in a shared problems surface. The same surface lists rejected-import problems today, and E3b (problems by field) and N1 (map-health checks) reuse it. Each problem of a rejected command is also written to the console through D1's diagnostics sink.

## Architecture Specification

**Scope**

- In: the UI edits that exist today (connect, delete steps and connections, move steps); the UI-only flag; the shared problems surface; D1 reporting for rejected commands; a dev-only command hook for e2e tests.
- Out: new UI edit features (add step, rename, edit metrics: E3b); undo (E5); store writes after each command (E1); a keyboard connect path (E3b); per-field inline problems (E3b); `#/help/problems/<code>` links (D3); map-health checks (N1).
- Import keeps its own pipeline (parse, upgrade, validate, confirm). Only its rejection list moves onto the shared surface. **Q 2026-11-22**

**Components**

- `src/flow/commands/`: a new UI-only command `move_step` (`stepId`, `x`, `y`) that sets one step's position. Entries gain an optional `uiOnly: true`. A pure `applyCommands(project, commands, context)` applies a list all or nothing: it stops at the first rejected command, and the original project comes back with every problem of that command. **Q 2026-11-22** (move as a command; atomic delete)
- `mcp/tools.js`: builds tools only from entries without `uiOnly`. A call to a UI-only name gets `CMD_TOOL_UNKNOWN`, like any unknown tool. The committed plugin bundle is rebuilt.
- Docs: `public/llms.txt` and `AGENTS.md` keep listing MCP tools only. `CLAUDE.md` gains one convention line: React UI edits go through `src/flow/commands`, and app-only commands are flagged `uiOnly`.
- `src/flow/problemsView.js` (pure): turns a heading and a problem list into what the surface shows: heading text, listed items (message and fix, at most 10), and an "and N more" line. `importFlow.js` uses it in place of its own list logic.
- `src/shell/ProblemsPanel.jsx` (thin): renders the view with a Dismiss button. Props choose whether the heading takes focus. `ImportStatus.jsx` renders it for a rejected import.
- `src/shell/useCanvasEdits.js`: holds the canvas (nodes and edges) as React Flow view state (selection and measured sizes stay there), applies UI edits as commands, and holds the last rejection for the panel. `src/shell/useProject.js` owns the in-memory project, the starter and the import flow.
- `src/App.jsx`: wires `onConnect`, `onBeforeDelete` (returns false; the edit removes) and `onNodesChange`/`onEdgesChange` (a drop change, `dragging: false`, becomes `move_step`; there is no `onNodeDragStop`) to commands. `isValidConnection` stays as the drag-time preview; the `connect` command is the authority.
- D1 sink: each problem of a rejected command goes to `report(problem)` from `src/shell/diagnostics.js`.
- Dev-only hook: in dev builds only, a test can send a command to the open project, so e2e tests can drive a rejection that today's UI cannot cause. It follows the pattern of D1's dev-only crash hook and is absent from production builds. **Q 2026-11-22**

**Constraints**

- Follow `CLAUDE.md`: functional ES modules, logic in `src/flow/` with colocated Vitest tests, thin React.
- Commands stay pure and never accept React Flow fields (`selected`, `measured`, `dragging`). Only allow-listed node and edge fields enter the project, as import does today.
- A move is applied once, on the drop change (`dragging: false`), not on every drag frame; each arrow-key press is one move.
- PRs that touch `src/flow` or `mcp/` merge one at a time (bundle rule in `plans/mvp-order.md`).

**Dependencies**

- E13 PR3 (merged): parity test, `llms.txt`, plugin bundle.
- D1 (in review on `feat/diagnostics-core`): `report(problem)`, the Vitest and Playwright gates with `expectDiagnostics`, `KNOWN_FIELDS`. R4's build starts after D1 merges.
- Merge before E1, E3a and E3b.

## Acceptance Criteria

Citations: **C** = MVP card or order row, **S** = existing spec, **Q** = stakeholder decision, **inference** = Ambiguity Log.

1. **One source of truth.** The canvas, step cards, metrics bar and export all read one in-memory project. After any accepted edit, cards and tiles agree in the same render, and export then import round-trips steps, positions, connections and metrics unchanged. Pass: existing `metrics.spec.js` and `export-import.spec.js` pass unchanged; a unit test of the project-to-canvas mapping. (C row 6; S ui-shell AC20, AC30)
2. **Connect is a command.** A pointer-drag connection runs the `connect` command. An accepted one appears with its arrowhead, exactly as today. The drag-time preview still refuses self, duplicate and loop connections. Pass: existing `connections.spec.js` passes unchanged; a unit test that the UI's connect handler builds a `connect` command from the drag's source and target. (C row 6; S ui-shell AC13, AC15)
3. **Delete is a command, all or nothing.** Delete or Backspace on a selection runs `disconnect` for each selected connection not attached to a selected step, then `remove_step` for each selected step, as one edit. If any part is rejected, nothing changes. Focus after delete works as today. Pass: unit tests on `applyCommands` (all accepted; one rejected leaves the project unchanged and returns every problem of the first rejected command, and later commands are not applied); existing delete e2e tests pass. (C row 6; S ui-shell AC17; Q 2026-11-22)
4. **Move is a UI-only command.** Dropping a dragged step runs `move_step` once with the step's final position. Export writes that position. Pass: unit tests on `move_step` (moves one step; unknown step rejected with `STEP_NOT_FOUND`; non-number position rejected); e2e drag then export shows the new position. (Q 2026-11-22)
5. **View state is not a command.** Selecting, measuring and hovering never run a command and never enter the project or the export. Pass: unit test that the mapping drops `selected`, `measured` and `dragging`.
6. **UI-only commands stay out of MCP.** `move_step` is not in the MCP tool list, and calling it over MCP returns `CMD_TOOL_UNKNOWN`. A test fails if any `uiOnly` command becomes a tool. `llms.txt` and `AGENTS.md` do not name it. The plugin bundle check passes after the rebuild. Pass: `mcp/tools.test.js`, `mcp/docs.test.js`, `npm run check:plugin`. (C row 6)
7. **Parity is unchanged.** The save-file parity test still passes, and a UI-only command never counts as the command for a field. Positions stay exempt. Pass: `parity.test.js` plus a case with a UI-only mapping that fails. (S ai-contract AC23; inference)
8. **Rejection is announced.** A rejected UI command changes nothing, and the live region says "Edit rejected: N problems. <first message>". Pass: unit test on the announcement text; e2e through the dev-only hook. (C row 6; inference, mirrors import's wording)
9. **Rejection is listed.** The problems surface shows the heading "Edit rejected: N problems", each problem's message and fix (at most 10, then "and N more"), and a Dismiss button. Focus stays where the user was. The list stays until Dismiss, a later rejection replaces it, and the next accepted edit clears it. Pass: unit tests on `problemsView.js`; e2e through the hook checks the list, Dismiss, the clear on the next edit, and axe. (C row 6; Q 2026-11-22)
10. **One surface for import and edits.** A rejected import renders through the same panel and view function. Its heading, announcement, focus to the heading, and Dismiss returning focus to Import work as today, and each item adds its fix line. Pass: existing import e2e tests pass, updated only for the fix line; a unit test that both callers build the same view shape. (C rows 6, 12, 14, 16; Q 2026-11-22)
11. **The surface is reusable.** The view takes any problem list and a heading, and keeps each problem's `code`, `stepId`, `edgeId` and `field`, so E3b can show problems by field and N1 can list gate problems. Pass: unit test that those keys survive into the view items. (C rows 14, 16)
12. **Rejections are logged.** Each problem of a rejected UI command is reported once through D1's `report`. No other path writes to the console. Pass: an e2e test through the hook declares the code with `expectDiagnostics` and finds its record; D1's console lint rule passes. (C row 4; D1 spec)
13. **Dev-only hook.** The command hook exists only in dev builds. Pass: the production bundle check finds no hook name; e2e uses it in the dev project only. (Q 2026-11-22; D1 precedent)
14. **Nothing else changes for the user.** All existing unit, e2e and a11y tests pass, with changes limited to AC10's fix line. Pass: `npm test`, `npm run test:e2e`, coverage and mutation at the current bar.
15. **The rule is written down.** `CLAUDE.md` says React UI edits go through `src/flow/commands` and app-only commands are flagged `uiOnly`. Pass: review. (inference)

## Glossary

| Term             | Definition                                                                                  | Status       | Source                      |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------ | --------------------------- |
| Command          | An entry in `COMMANDS`, applied by `applyCommand`, that validates and returns every problem | `verified`   | `docs/specs/ai-contract.md` |
| UI-only command  | A command the app uses but the MCP server never offers as a tool                            | `unverified` | Row 6; E1 card              |
| Edit             | One user action applied as one or more commands, all or nothing                             | `unverified` | This spec                   |
| Rejected command | A command that returns `ok: false`; the project is unchanged                                | `verified`   | `docs/specs/ai-contract.md` |
| Problems surface | The shared panel and its pure view that list problems with a heading and Dismiss            | `unverified` | Row 6; E3b, N1, D3 cards    |
| View state       | React Flow state that is not project data: selection, measured size, dragging, hover        | `unverified` | This spec                   |

## Ambiguity Log

| Decision                                                              | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag positions: a UI-only command, or view state outside the commands | `requires-stakeholder-input` | human       | Accepted 2026-11-22: UI-only `move_step` on drag stop. One path for every project change, and E5 undo and E1 store writes get moves for free. Rejected: keeping positions in React state.             |
| Deleting several items at once                                        | `requires-stakeholder-input` | human       | Accepted 2026-11-22: one all-or-nothing edit, so a partial delete never happens and E5 undoes it in one step. Rejected: one command per item.                                                         |
| Import's rejection list on the shared surface, with fix lines         | `requires-stakeholder-input` | human       | Accepted 2026-11-22: yes, one panel for import and edits; both show message and fix. Changes the import list's look by one line per item.                                                             |
| Focus and lifetime of an edit rejection                               | `requires-stakeholder-input` | human       | Accepted 2026-11-22: announce only, no focus move (a drag on the canvas should not lose its place); list stays until Dismiss, is replaced by a later rejection, and clears on the next accepted edit. |
| Dev-only command hook for e2e                                         | `requires-stakeholder-input` | human       | Accepted 2026-11-22: yes, dev builds only, like D1's crash hook. Today's UI cannot cause a rejection, so without it the surface is proven by unit tests only.                                         |
| Import replacement through the commands                               | `requires-stakeholder-input` | human       | Accepted 2026-11-22: no; import keeps its pipeline and E1 moves open into the store.                                                                                                                  |
| Problems from a rejected multi-command edit                           | `requires-stakeholder-input` | human       | Accepted 2026-11-22 at the plan gate: stop at the first rejected command and return only its problems; later commands would run against a state that never exists.                                    |
| Success announcements                                                 | `inferable`                  | inference   | Today connect, delete and move are not announced. A refactor keeps that.                                                                                                                              |
| Rejection wording                                                     | `inferable`                  | inference   | Mirrors import: "Import rejected: N problems. <first message>". `rejectCommand`'s summary names internal command names, so the UI uses its own heading.                                               |
| How the flag is stored                                                | `inferable`                  | inference   | `uiOnly: true` on the table entry, like `needsProject` and `replacesProject`.                                                                                                                         |
| UI-only command over MCP                                              | `inferable`                  | inference   | The tool layer already answers unknown names with `CMD_TOOL_UNKNOWN`; a UI-only command is simply not a tool.                                                                                         |
| Parity and UI-only commands                                           | `inferable`                  | inference   | Parity is about what an AI can set. A field only a UI-only command sets would break that promise.                                                                                                     |
| Unsaved-changes count in the UI                                       | `inferable`                  | inference   | The UI has no save today; it applies commands to the project, not a session. E1 decides store writes.                                                                                                 |
| Connect preview                                                       | `inferable`                  | inference   | `isValidConnection` keeps the drag feedback users have; the command still decides.                                                                                                                    |
| D1 reporting                                                          | `inferable`                  | inference   | D1 spec: "Commands log once R4 routes the UI through them." `KNOWN_FIELDS` already covers command fields.                                                                                             |
| CLAUDE.md line                                                        | `inferable`                  | inference   | E3b and later items must follow the rule; a convention line is how this repo records rules.                                                                                                           |
| CRUD: steps                                                           | `inferable`                  | inference   | Create and rename have no UI yet (E3b). Update is move only. Delete through `remove_step`. Read is the canvas.                                                                                        |
| CRUD: connections                                                     | `inferable`                  | inference   | Create through `connect`, delete through `disconnect`. No update exists.                                                                                                                              |
| CRUD: project                                                         | `inferable`                  | inference   | Replace stays with import; create and rename are E1.                                                                                                                                                  |
| CRUD: problems surface                                                | `inferable`                  | inference   | Created by a rejection, read on screen, removed by Dismiss or the next accepted edit.                                                                                                                 |
| Auth, authorization, audit                                            | `inferable`                  | inference   | Static site, no accounts. Logging is D1's sink.                                                                                                                                                       |
| Errors                                                                | `inferable`                  | inference   | Every rejection path is a catalog problem from the command layer; no new codes.                                                                                                                       |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human
