<!-- spec-version: 14.2.0 -->

# Spec: E1 Homepage

Source: issue #27 (the source of truth for the item), row 8 of `plans/mvp-order.md`, the E1 card in `plans/mvp-cards.md` (its defaults are accepted by the user), the deferred questions S2, S4 and S10–S12 in `docs/specs/ui-shell.md`, and R4's spec `docs/specs/ui-on-commands.md`, which E1 builds on. Stakeholder decisions are marked **Q**; the card's accepted decisions are marked **C**.

**Status:** gate passed 2026-11-22. The user declined a prototype and accepted all four open decisions as recommended. Plan review added AC30–AC35, accepted by the user 2026-11-22 with the plan.

**Prototype:** declined by the user 2026-11-22. Issue #27 is labelled `small`, not `size:prototype`, its open questions are "none", and the build order does not mark E1 _prototype first_. The card fixes the surfaces (list, create dialog, card actions, not-found state); the layout choices left are conventional and are settled below.

## Intent Description

Today the app opens one starter project on every load and keeps nothing: a reload throws away every change. The home route `#/` and the project route `#/projects/<id>` (N13) render the same map.

This change makes the homepage the entry point for every session. It lists the projects saved in this browser, sorted by date modified or by name, and lets the user create a project (name only), open, rename, duplicate and delete one, and import and export one from its card. The projects live in the browser's IndexedDB as save-file text, so a project survives a reload and opens at its own link. Every successful change to an open project is saved at once; there is no Save button.

A new project is an empty map with a one-line hint; the six starter steps go away. Renaming is a command, so an AI tool can rename a project over MCP too (`rename_project`). Every new failure (storage blocked, a write that fails, a project that is not found, a saved copy that cannot be opened) has its own catalog code and repair guide.

## Architecture Specification

**Scope**

- In: the browser project store; the homepage list, sort and empty state; create, open, rename, duplicate, delete; per-card import and export; homepage import; the project-not-found and cannot-open states; save after every successful change; the `rename_project` command, MCP tool and `llms.txt` entry; four `STORE_` catalog codes with guides; the header link home; replacing the "stores nothing" e2e test.
- Out: the project type picker (E2), usage events (N14), help pages (N17 frame), undo (E5), file autosave (row 27), a header rename or project switcher, live sync between tabs.

**Components** (named for responsibility; `/plan` chooses files)

1. **Project store, pure part** (`src/flow/`). Operations over an injected key-value adapter: `list`, `read(id)`, `write(id, text, meta)`, `remove(id)`, `has(id)`. It builds the index entry `{ id, name, modifiedAt }`, sorts the list, derives the duplicate's name, and picks the id for a homepage import. Unit tested with an in-memory adapter.
2. **IndexedDB adapter** (`src/shell/`, thin). One database, `ai-enabler`, version 1, with two object stores in one transaction per write: `files` (id → save-file text) and `index` (id → `{ id, name, modifiedAt }`). The list reads only `index`, so it never loads every file. Its failures map to `STORE_` codes. Proven by e2e against the real browser.
3. **Homepage** (React). A heading "AI Enabler", a "Projects" list of cards, a sort control, "New project" and "Import project" buttons, and an empty state when nothing is saved. Each card shows the name and the modified date, opens the project, and has a menu: Rename, Duplicate, Replace from file, Export, Delete.
4. **Project dialog** (React). One name field, used for create and rename. A rejected command shows its problems in the dialog and keeps it open.
5. **Project route.** `#/projects/<id>` reads the stored text and runs the import pipeline (parse, upgrade, validate) into the in-memory project from R4. A missing id shows the not-found state; a stored file that fails the pipeline shows the cannot-open state. Both link home.
6. **Save after change.** After each accepted edit (R4's `applyEdit`), confirmed import, create and rename, the in-memory project is serialized to the export form (`toProjectFile`, then `withContentHash`) and written with `modifiedAt` set to the time of the change. Writes for one project run in order, so the newest change is the one stored.
7. **`rename_project` command** in `src/flow/commands/`. Argument `name`; sets `project.name`; validation rejects a blank name with the existing `FILE_PROJECT_NAME_EMPTY`. It is an MCP tool (not `uiOnly`), so `mcp/tools.js` offers it, and the plugin bundle is rebuilt.
8. **Catalog and guides.** New codes `STORE_UNAVAILABLE`, `STORE_WRITE_FAILED`, `STORE_PROJECT_NOT_FOUND`, `STORE_FILE_INVALID` in `catalog.json`, `owner: "app"`, each with a guide in `src/flow/diagnostics/guides/<CODE>.md` under D2's format. No tool repairs a browser-store problem, so each guide uses D2's "No tool repairs this." marker and says what to tell the user.
9. **Problems surface.** Store and card-import rejections render through R4's shared `ProblemsPanel` and `problemsView.js`. Each problem is reported once through D1's `report`.

**Constraints**

- Follow `.claude/CLAUDE.md`: functional ES modules, logic in `src/flow/` with colocated Vitest tests, thin React.
- No runtime dependency. A dev dependency (for example an IndexedDB fake) needs a reason in the plan.
- No network calls. The store holds data only in this browser.
- No schema change and no bump: `project.name` and `project.id` already exist. The parity mapping for `project.name` gains `rename_project.name`.
- Store operations (list, open, duplicate, delete, export) are not commands, so they never become MCP tools and need no `uiOnly` flag. **C** ("store operations, flagged UI-only")
- Problem messages never hold a project name; names go in `untrusted`, as today.
- PRs that touch `src/flow` or `mcp/` merge one at a time (bundle rule).
- `src/flow/initialFlow.js` stops being the app's default. Its six steps stay as test data, so e2e tests seed a project from a fixture instead of relying on a starter map.

**Dependencies**

- Merged: N13 (routes), E13 PR1–PR3 (commands, validator, `llms.txt`, plugin), D1 (diagnostics sink and gates), D2 (guide files and the test that fails on a code with no guide, #52), R4 (commands for UI edits, `applyEdit`, `ProblemsPanel`, #53).

## Acceptance Criteria

Citations: **I** = issue #27, **C** = E1 card or row 8, **S** = existing spec, **Q** = stakeholder decision, **inference** = Ambiguity Log.

**Homepage and list**

1. `#/` shows the homepage, not a map: the heading "AI Enabler", a "Projects" region, "New project" and "Import project" buttons. The document title is "AI Enabler". Pass: e2e. (I; C)
2. Each saved project appears as one card with its name and modified date. With no saved projects the list shows "No projects yet. Create one or import a project file." Pass: e2e with zero, one and three projects. (I; inference)
3. The list sorts by "Last modified" (newest first) by default, and by "Name" (A to Z, case-insensitive, locale order) on request. Ties keep a stable order by id. Pass: unit tests on the sort; e2e switches the sort. (I; inference)
4. In a project view the "AI Enabler" brand in the header links to `#/`. Pass: e2e. (C)

**Create and open**

5. "New project" opens a dialog with one required name field. Create runs `create_project`; on success the project is saved, listed, and opened at `#/projects/<id>`. **Q 2026-11-22** A blank name keeps the dialog open and shows `FILE_PROJECT_NAME_EMPTY`. Cancel changes nothing. Pass: unit test on the create path; e2e. (I; C)
6. A new project has no steps, and the map shows one hint line: "This map has no steps yet. Import a project file to fill it." Pass: e2e. (C "empty map with a one-line hint"; inference for the wording)
7. Opening a card goes to `#/projects/<id>` and shows that project. A direct load or reload of that link shows the same project. Pass: e2e. (I; S N13)
8. Opening runs the stored text through the import pipeline, so a file saved at an older schema version opens upgraded. Opening alone writes nothing and leaves `modifiedAt` unchanged. Pass: unit test with a 0.0.0 fixture in the store. (C; inference)
9. An id with no stored project shows "Project not found" with a link home, and reports `STORE_PROJECT_NOT_FOUND`. Pass: e2e. (C)
10. A stored file that fails the pipeline shows "Can't open <name>" with a link home, and lists `STORE_FILE_INVALID` followed by the pipeline's own problems in the problems panel. The card stays listed and can still be exported and deleted. Pass: e2e with a corrupt record written to the store. (C; inference)

**Save after change**

11. Every accepted change to an open project (connect, delete, move, rename, confirmed import) is written to the store before the next change starts; a rejected change writes nothing. After any accepted change, a reload shows the change. Pass: e2e deletes a step, reloads, and still sees the step gone; unit test that a rejected edit makes no write. (C **accepted**)
12. The stored text is the export form, `contentHash` included, so exporting it and importing that file shows no "changed outside AI Enabler" notice. Pass: unit test. (C default)
13. Writes for one project apply in the order the changes were made. Pass: unit test with a slow adapter and two changes. (inference)
14. A failed write keeps the change in memory, reports `STORE_WRITE_FAILED`, announces it, and lists it in the problems panel. Export still works. The next successful write stores the latest state. Pass: e2e with an init script that makes IndexedDB writes fail; unit test on the recovery. (C; inference)

**Rename, duplicate, delete**

15. Rename on a card opens the project dialog with the current name. Save runs `rename_project` and writes the result. A blank name is rejected as in AC5. Pass: unit tests on `rename_project`; e2e. (I; C)
16. Duplicate saves a copy with a new id, the name "<name> (copy)", the same steps, positions and connections, and `modifiedAt` now. Names need not be unique. The homepage stays open, focus moves to the new card, and "Duplicated <name>" is announced. Pass: unit test; e2e, including focus. (I; C default; Q 2026-11-22)
17. Delete asks "Delete <name>? This can't be undone." through `ConfirmDialog`. Confirm removes the file and its index entry and announces "Deleted <name>"; Cancel changes nothing. Focus moves to the next card, else the previous card, else "New project". Pass: e2e, including focus. (I; S ui-shell AC17 focus pattern)

**Import and export**

18. Import on a card asks "Replace <card name> with <file name>?" with the edited and AI notices that apply (ui-shell AC48, ai-contract). Confirm replaces that project's map and name, keeps the card's id, and saves. Cancel changes nothing. A rejected file changes nothing and lists its problems in the problems panel. Pass: e2e. (C **accepted**; S ui-shell AC33–35, AC48)
19. "Import project" on the homepage adds the file as a new project with no confirmation, because nothing is replaced. It keeps the file's `project.id` unless a stored project already has that id; then it gets a new id. The homepage stays open, focus moves to the new card, and the outcome is announced with any notices that apply. Pass: unit test on the id choice; e2e for both cases, including focus. (C **accepted**; inference for no confirmation; Q 2026-11-22)
20. Export on a card downloads `<slug>.ai-enabler.json`, the same file that opening the project and pressing Export would give. For a stored file that cannot be opened (AC10), it downloads the stored text unchanged so nothing is lost. Pass: e2e compares the two downloads; unit test for the raw case. (I; S ui-shell AC28; inference)

**Store failures**

21. When IndexedDB cannot be opened (blocked or unsupported), the homepage reports `STORE_UNAVAILABLE` and shows it in the problems panel. The app keeps working with an in-memory store for this tab: create, open, edit, rename, duplicate, delete, import and export all work until the tab closes. A notice that stays on every screen says "Not saved in this browser. Export to keep your work." Pass: unit test that the memory adapter passes the same store tests; e2e with IndexedDB disabled by an init script creates a project, edits it, exports it, and sees the notice on the homepage and the project view. (C; Q 2026-11-22)
22. Every store problem shown is reported once through D1's `report`, and the D1 gates pass. Pass: e2e declares the codes with `expectDiagnostics`. (D1 spec)

**AI contract**

23. `rename_project` is an MCP tool with one required argument, `name`. It renames the open project, counts as an unsaved change in the MCP session, and rejects a blank name. `public/llms.txt` lists it under the MCP tools, the parity test maps `project.name` to `create_project.name` and `rename_project.name`, and `npm run check:plugin` passes after the bundle rebuild. Pass: `mcp/tools.test.js`, `mcp/docs.test.js`, `parity.test.js`, `check:plugin`. (C **accepted**; row 8 rule: command, MCP tool and `llms.txt` entry)
24. The four `STORE_` codes are in `catalog.json` with a guide each, and D2's guide tests pass. Pass: D2's `guides.test.js`. (row 8 rule)

**Tests and docs replaced**

25. The e2e test "reloading after deleting Idea restores six steps and stores nothing" is replaced by AC11's reload test plus a check that IndexedDB holds exactly one database, `ai-enabler`. ui-shell AC27 and its "no browser storage" constraint are marked superseded by this spec. The ui-shell export-shape test (AC45) compares a fixture project's export instead of the removed starter. Pass: e2e and unit suites. (C; I)
26. E2e tests that relied on the starter map seed a project from the six-step fixture first. The N13 route tests change to: `#/` shows the homepage, and a stored project's link survives a direct load and a reload. Pass: `npm run test:e2e`. (inference)
27. The help menu's "How to use" list says that projects save automatically in this browser, and that with one project open in two tabs the last change wins. Pass: e2e reads both lines. (C default "help says so")
28. All homepage states (list, empty, dialog, not found, cannot open) pass the axe scan, and every control is reachable and usable by keyboard. Pass: e2e axe checks. (S ui-shell AC38–40)
29. The header Import inside an open project follows the card-import rule: it asks first (AC33 wording, both names), replaces that project's map and name, keeps the open project's id, and saves. The file's id never replaces it, so ui-shell AC34's id swap is superseded. Pass: unit test on the import reducer; e2e imports a file with a different id and name, reloads, and finds the project at the same link. (Q 2026-11-22; S ui-shell AC33–36)

**Added at plan review (accepted 2026-11-22)**

30. A card whose stored file fails to open offers only "Replace from file", Export and Delete; Rename and Duplicate are hidden. Replace from file repairs it without reading the old file. A write failure alone never restricts a card. Pass: e2e menu check and repair-by-replace. (Q 2026-11-22)
31. A homepage write the browser refuses (create, rename, duplicate, delete, import, replace) changes nothing. Create and rename keep their dialog open with the typed name and the problem; the others list `STORE_WRITE_FAILED` above the list and return focus to the card's actions button or "Import project". Nothing navigates and no success is announced. Pass: e2e per action with writes aborted. (Q 2026-11-22)
32. The notice "Not saved in this browser. Export to keep your work." also shows after a failed save of the open project, until a later save of it succeeds. While the notice shows, closing or reloading the tab asks first. Leaving a project whose last change was not saved for another route (the header home link, a Help link, or the browser's Back) asks "Leave without saving? Your last change to <name> is not saved in this browser. Export first to keep it." with Leave and Stay; Stay keeps the user and the change on the map. Leaving is not asked when every change is saved, including in the memory fallback, where the project stays in this tab's memory store. Pass: e2e for the home link and Back, both answers. (Q 2026-11-22; coordinator 2026-11-22, raised by N17's planner)
33. Every import confirmation reads "Replace <current name> with <incoming name>?", or "Replace <name> with the imported version of <name>?" when the names match. This supersedes ui-shell AC33–34's "Replace current map with …". Pass: reducer unit tests; e2e. (Q 2026-11-22)
34. The card's import action is labelled "Replace from file"; the homepage's is "Import project". Pass: e2e. (Q 2026-11-22)
35. On the first successful write the app asks the browser once for durable storage, with no UI. Help adds "Clearing this site's data deletes its projects. Export to keep a copy." Pass: unit test that the request is made once; e2e help line. (Q 2026-11-22)

## Glossary

| Term            | Definition                                                                                            | Status       | Source             |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| Project store   | The IndexedDB database `ai-enabler` that holds this browser's projects                                | `unverified` | E1 card; this spec |
| Stored file     | One project's save-file text in the store, in the export form with `contentHash`                      | `verified`   | E1 card (accepted) |
| Project index   | The store's `{ id, name, modifiedAt }` entry per project, read to build the list                      | `verified`   | E1 card (accepted) |
| Card            | One project's entry on the homepage, with its actions menu                                            | `unverified` | Issue #27          |
| Homepage        | The `#/` route: the project list and its actions                                                      | `unverified` | Issue #27          |
| Store operation | A store action that is not a command (list, open, duplicate, delete, export) and is never an MCP tool | `unverified` | E1 card            |

## Ambiguity Log

| Decision                                                                 | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What IndexedDB stores                                                    | `requires-stakeholder-input` | human       | Accepted (C): the save-file text, with `modifiedAt` in the index.                                                                                                                                                                                    |
| When to write                                                            | `requires-stakeholder-input` | human       | Accepted (C): after every successful change.                                                                                                                                                                                                         |
| What a new project holds                                                 | `requires-stakeholder-input` | human       | Accepted (C): an empty map with a one-line hint; the starter steps go.                                                                                                                                                                               |
| Import id clashes                                                        | `requires-stakeholder-input` | human       | Accepted (C): card import replaces and keeps the card's id; homepage import keeps the file's id unless taken.                                                                                                                                        |
| Rename over MCP                                                          | `requires-stakeholder-input` | human       | Accepted (C): add `rename_project`.                                                                                                                                                                                                                  |
| `contentHash` in stored text; duplicate name; two tabs                   | `requires-stakeholder-input` | human       | Card defaults, accepted by the user: with hash; "<name> (copy)"; last write wins, help says so.                                                                                                                                                      |
| Durations                                                                | `inferable`                  | inference   | Accepted rule: working-time minutes. E1 adds no duration.                                                                                                                                                                                            |
| Two-store IndexedDB layout                                               | `inferable`                  | inference   | The card's index lets the list skip file texts. Check passed: one store with all fields is ruled out by the card's separate index.                                                                                                                   |
| Opening writes nothing                                                   | `inferable`                  | inference   | Opening is not a change; writing would reorder "Last modified". Check passed: "write back the upgraded file on open" would move the card to the top without an edit.                                                                                 |
| Card shows name and date only                                            | `inferable`                  | inference   | The index holds only id, name and modifiedAt; a step count would need every file read. Check passed.                                                                                                                                                 |
| Default sort and direction; sort not remembered                          | `inferable`                  | inference   | "Last modified, newest first" is the issue's "date modified" in its usual order. Remembering the sort was considered; no source asks for it, and it can come later without a contract change.                                                        |
| Hint wording                                                             | `inferable`                  | inference   | Until E3b there is no add-step UI, so the hint can only point to import. E3b updates it.                                                                                                                                                             |
| Homepage import needs no confirmation                                    | `inferable`                  | inference   | ui-shell confirms because import replaces work; a homepage import replaces nothing. Notices are still announced.                                                                                                                                     |
| Card export output                                                       | `inferable`                  | inference   | Same as open-then-export keeps one export rule; the raw fallback keeps an unopenable file recoverable. Check passed: "always download stored text as-is" would ship a stale `exportedAt`.                                                            |
| Rename and delete only from cards                                        | `inferable`                  | inference   | Issue #27 puts them on each card; a header rename is out of scope.                                                                                                                                                                                   |
| Store operations are not commands                                        | `inferable`                  | inference   | Commands transform one project; list and delete do not. Not commands means never MCP tools.                                                                                                                                                          |
| Write ordering per project                                               | `inferable`                  | inference   | Save after every change only holds if the newest write lands last.                                                                                                                                                                                   |
| Failed write keeps the change                                            | `inferable`                  | inference   | Mirrors the MCP store: FILE_SAVE_FAILED keeps the project in memory.                                                                                                                                                                                 |
| Names: no trim, no max, not unique                                       | `inferable`                  | inference   | Same rules as `create_project` and the validator today; ids tell projects apart.                                                                                                                                                                     |
| Starter steps become test data                                           | `inferable`                  | inference   | Most e2e tests need a six-step map; a fixture keeps them stable.                                                                                                                                                                                     |
| Worked-example acceptance line                                           | `inferable`                  | inference   | Withdrawn 2026-11-22. The draft misread two cards: the line "the worked example within 5% of 350 / 438 / 503 h" belongs to E11's card (row 26), not E1's, so `plans/mvp-cards.md` needs no change. E1 computes nothing, so it has no such criterion. |
| CRUD: project                                                            | `inferable`                  | inference   | Create (AC5), read (AC1–3, 7), update (rename AC15, import AC18, edits AC11), delete (AC17).                                                                                                                                                         |
| CRUD: stored file and index                                              | `inferable`                  | inference   | Written together, removed together (AC11, AC17); never edited by hand in the app.                                                                                                                                                                    |
| Auth and authorization                                                   | `inferable`                  | inference   | Static site, no accounts; the store is per browser profile.                                                                                                                                                                                          |
| Audit and logging                                                        | `inferable`                  | inference   | D1's sink records each store problem; names stay in `untrusted`.                                                                                                                                                                                     |
| Error handling                                                           | `inferable`                  | inference   | Every store failure maps to one of the four codes (AC9, 10, 14, 21).                                                                                                                                                                                 |
| Where the user lands after create, duplicate and homepage import         | `requires-stakeholder-input` | human       | Accepted 2026-11-22: create opens the new project; duplicate and homepage import stay on the homepage with focus on the new card. Rejected: all three open the project.                                                                              |
| The header Import inside an open project                                 | `requires-stakeholder-input` | human       | Accepted 2026-11-22: keep it; it replaces that project and keeps its id (AC29). Rejected: removing the header Import.                                                                                                                                |
| When IndexedDB is unavailable                                            | `requires-stakeholder-input` | human       | Accepted 2026-11-22: keep working in memory for this tab with a lasting "Not saved in this browser. Export to keep your work." notice (AC21). Rejected: disabling create and import.                                                                 |
| Plan-review rules (AC30–AC35); no "Saved" indicator; empty map until E3b | `requires-stakeholder-input` | human       | Accepted 2026-11-22 with the plan. No "Saved" indicator: the lasting notice covers failure. A new project can be filled only by import until E3b or N17.                                                                                             |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human
