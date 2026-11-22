# MVP dependency cards (rows 8–27)

**Created**: 2026-11-22. Source: `plans/mvp-order.md` v2, the product plan, `plans/ai-contract.md`, `docs/specs/*.md`, `docs/schema-versioning.md`, issues #26–#41, and the code under `src/flow` and `src/shell`.

A card lists what an item touches and what must land first. It is not a spec: `/dev-team:specs` writes the full spec when the item starts, with the card as input. Each decision has a default. Those marked "Accepted 2026-11-22" are approved by the user; the rest are recommended defaults that the spec confirms or changes. Schema versions assume E13 PR2 ships 0.1.0.

**Updated**: 2026-11-22. Rows 15–27 added, and their defaults accepted by the user. E3a ships 1.0.0 with every slot rows 18–23 need, so after it only three rows bump, in table order: 15 → 1.1.0, 18 → 1.2.0, 24 → 1.3.0. Severities are `error`, `warning` and `hint`.

## Row 8 · E1 (#27) Homepage

- **UI surfaces:** home route `#/` with the project list, sortable by name and date modified. Create dialog (name only). Per-card open, rename, duplicate, delete (confirm via `ConfirmDialog`), import and export. Header link back home. An unknown `#/projects/<id>` shows a "project not found" state with a link home.
- **Save file:** no field change, no bump. IndexedDB holds each project's save-file text; an index holds `{ id, name, modifiedAt }`. Opening a stored file runs the import pipeline (validate, then upgrade), so old stored files upgrade on open.
- **Commands, MCP, `llms.txt`:** create and rename go through commands (R4). List, open, duplicate and delete are store operations, flagged UI-only. No `llms.txt` change.
- **Catalog and guides:** new `STORE_` area: store unavailable (private mode or blocked), write failed (quota), project not found, stored file invalid. Each gets a guide (D2).
- **Usage and routes:** no new routes. `project-created` is wired by N14 (row 11), not here.
- **Shared files:** `src/shell/useProject.js` (starter project becomes a store load), `App.jsx`, `routes.js`, `Header.jsx`, `ConfirmDialog.jsx`, `src/flow/importFlow.js`, `e2e/shell.spec.js` ("stores nothing" test replaced; ui-shell AC27 retired). Merge first: R4, D2.
- **Needs:** 6, 7. **Parallel with:** —.
- **Decisions:**
  - When to write the store. Accepted 2026-11-22: after every successful command, so nothing is lost on reload.
  - What a new project holds. Accepted 2026-11-22: an empty map with a one-line hint; the six starter steps go away.
  - Store text with or without `contentHash`. Default: with, so a stored file is a real export and opens without the "edited" notice.
  - Import id clashes. Accepted 2026-11-22: per-card import replaces that card's project and keeps its id; a homepage import keeps the file's id unless it is taken, then gets a new one.
  - Duplicate name. Default: "<name> (copy)".
  - Rename over MCP. Accepted 2026-11-22: yes, add `rename_project`; the name is a save-file field.
  - Two tabs on one project. Default: last write wins; help says so.

## Row 9 · E2 (#28) Project type

- **UI surfaces:** a required Software / Office picker in E1's create dialog. A type badge on each project card and in the header. "Duplicate as office/software" in the card menu.
- **Save file:** `project.type`, `software` or `office`. Minor bump 0.1.0 → 0.2.0: fixture `0.2.0.json`, upgrade hop, `public/schema/project-0.2.0.json`, plugin rebuild, `PROJECT_FIELDS` in `projectFile.js`.
- **Commands, MCP, `llms.txt`:** `create_project` gains `type`. No command changes type, which satisfies parity through `create_project`. `llms.txt` gives the field, its values and that it is fixed. Skills declare schema major 0.
- **Catalog and guides:** unknown project type (validator) and invalid `type` argument (command), each with a guide.
- **Usage and routes:** none.
- **Shared files:** `src/flow/project.js`, `projectFile.js`, `schema/version.js`, `schema/upgrades.js`, `schema/validate.js`, fixtures, `src/flow/commands/`, `public/schema/`, `public/llms.txt`, `plugin/`, E1's create dialog and card. Merge first: E1. Schema-serial with E3a.
- **Needs:** 8. **Parallel with:** 10.
- **Decisions:**
  - Type for files without one. Accepted 2026-11-22: the upgrade hop sets `software`; every map so far is idea to production.
  - `type` on `create_project`. Default: optional, defaulting to `software`, so 0.1.0 clients keep working.
  - Picker default. Accepted 2026-11-22: Software preselected.
  - Profile extras now. Default: none. DORA, takt, FTE, systems-per-box and the office-to-software link ship with the items that use them.

## Row 10 · N17 (#41) Help frame

- **UI surfaces:** routes `#/help` and `#/help/<page>`. Pages for every shipped item (canvas basics, connect and delete, metrics tiles, import/export, homepage, AI tools and the MCP server), a VSM primer, a glossary page from `glossary.js`, skill install steps for the plugin, and "Works with: aie-…" chips on features that use a skill. The Help menu links into these pages. The footer shows the app version and links `CHANGELOG.md` (D1).
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** none. `llms.txt` links the primer and glossary.
- **Catalog and guides:** none. An unknown help page rewrites to `#/help`, like today's route rewrite. Leaves a `#/help/problems/<code>` slot for D3.
- **Usage and routes:** new templates `/help` and `/help/:page` (page names are a fixed set, so they are safe to count). N14 adds them.
- **Shared files:** `src/shell/routes.js`, `useRoute.js`, `App.jsx`, `HelpMenu.jsx`, `glossary.js`, `Header.jsx`. Merge first: E1 (home link), E13 PR3 (plugin install steps), D1 (app version).
- **Needs:** 8, 5, 4. **Parallel with:** 9. E2's help page lands in whichever of the two merges second.
- **Decisions:**
  - Help inside the SPA or a docs site. Default: inside the SPA, so it works offline and matches the app version (issue default).
  - Page format. Default: plain JS content modules under `src/shell/help/`, no Markdown dependency.
  - Screenshots. Default: none in the frame; add them later from Playwright captures.

## Row 11 · N14 (#26) GoatCounter

- **UI surfaces:** a Privacy help page (`#/help/privacy`) with the note, the opt-out control, and why counting is off when GPC or Do Not Track is set. The control is keyboard operable and announced. Spec: `docs/specs/goatcounter.md` (parked), revised as below.
- **Save file:** none. The opt-out is a `localStorage` preference, not exported and not in `llms.txt`.
- **Commands, MCP, `llms.txt`:** none. No counting in the MCP server or skills.
- **Catalog and guides:** one code, `USAGE_SEND_FAILED`, severity hint: a coded D1 record, rate-limited, never shown in the UI. Its guide says no action is needed (ad blockers block it). This replaces the spec's "no catalog code" inference.
- **Usage and routes:** route templates `/`, `/projects/:id`, `/help`, `/help/:page`. Events for features that exist now: `project-created`, `project-imported`, `project-exported`, `skill-install-clicked`. The rest of the issue's list is reserved for later items. Production origin only; nothing from dev, preview, e2e or forks.
- **Shared files:** new `src/shell/usage.js` (pure) and a sender, `useRoute.js`, the help frame, call sites in `useProject.js` and E1's store, `catalog.json`. Merge first: E1, N17 frame, D1.
- **Needs:** 8, 10, 4. **Parallel with:** —.
- **Decisions:**
  - How counts are sent. Accepted 2026-11-22: our own few lines posting to GoatCounter's endpoint, with no third-party script. A compromised CDN script could read the map.
  - GPC and Do Not Track. Accepted 2026-11-22: treat them as an opt-out.
  - Site code. Accepted 2026-11-22: `ai-enabler.goatcounter.com`, created by you before the first deploy; the code sits in source, it is not a secret.
  - `help-opened` event. Accepted 2026-11-22: drop it; `/help/:page` views already count help use.

## Row 12 · D3 Access, export, docs

- **UI surfaces:** a "Report a problem" help page with a "Copy diagnostics" button that copies the session's recent coded records as JSONL (redacted by D1's allow-list), with a download fallback. Generated pages at `#/help/problems/<code>`, one per catalog code, from `catalog.json` and the D2 guides. Each problem in the import list and R4's problems surface links to its page.
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** no commands. `llms.txt` links the problems index. Dev-only access: D1's console records, read through Chrome DevTools MCP, with a help page on connecting it; no global API in production builds.
- **Catalog and guides:** one code for a blocked clipboard, with a guide. A test fails on any code with no generated page.
- **Usage and routes:** template `/help/problems/:code` (codes are a fixed set). Event `diagnostics-copied`.
- **Shared files:** `catalog.json`, D2 guide files, the help registry, `routes.js`, `ImportStatus.jsx`, R4's problems surface, D1's record buffer, the Vite build (page generation). Merge first: N17 frame, D1, N14. Builds alongside E3a; both touch `catalog.json`, so merge one at a time.
- **Needs:** 10, 4, 11 (adds its route and event to N14's lists). **Parallel with:** 13.
- **Decisions:**
  - Where "Copy diagnostics" lives. Default: the "Report a problem" help page, linked from the Help menu.
  - How many records it copies. Default: the last 200 from this session.
  - Docs links in MCP results. Default: no; keep D3 out of `mcp/`, and let the catalog's docs anchor carry the link.

## Row 13 · E3a (#29) Schema v1 contract

- _Prototype first_: one prototype covers E3a and E3b; the handoff feeds both specs, and prototype code is not merged.
- **UI surfaces:** none new. Current cards and tiles keep working: they read `wt` and show LT = WT + PT. The import outcome names any box whose WT was clamped by the upgrade.
- **Save file:** major bump 0.2.0 → 1.0.0. `pt`, `wt`, `ca` become metric objects `{ typical, low?, high?, source?, confidence? }`. `wt` replaces `lt` (hop: `wt = lt − pt`). Nodes and edges move into `maps[]`, the first map with state `current`. `edges[].type` is added. Boxes gain `unit` (text, so custom units need no bump), `trigger { type, interval }` and `batchSize`, plus description, owner role, team, headcount, performer, WIP and oldest item. Reserved for later rows: `edges[].rate` (E6), `edges[].ratio` (N15), `maps[].endMarkers` (N4), `maps[].name` and `maps[].basedOn` (E7). Durations are integer minutes. Fixture `1.0.0.json`, hop, `project-1.0.0.json`, plugin rebuild.
- **Units module:** one pure module for 1h = 60, 1d = 480, 1w = 2400, 1mo = 9600, parse and format; it replaces `src/flow/duration.js`. E3b switches the display to it.
- **Commands, MCP, `llms.txt`:** `set_step_metrics` takes `wt` in place of `lt`; `update_step` takes the new box fields; trigger and unit commands are added. Step commands take an optional `mapId`. The `data-complete` gate checks `pt`, `wt`, `ca`, `queue`. `llms.txt` and `aie-guide` rewritten for v1; skills declare major 1 and warn on 0.x files.
- **Catalog and guides:** new codes for a non-integer duration, a range out of order (low ≤ typical ≤ high), an unknown edge type, an invalid trigger or unit, and an empty or malformed `maps[]`. `MAP_` stays reserved for N1, so `maps[]` problems use `FILE_`. Each gets a guide.
- **Usage and routes:** none.
- **Shared files:** `src/flow/schema/*`, `step.js`, `projectFile.js`, `metrics.js`, `duration.js`, `initialFlow.js`, `src/flow/commands/`, `src/flow/gates/`, `mcp/`, `public/schema/`, `public/llms.txt`, `plugin/`, `StepCard.jsx`. Merge first: E2 (schema order), R4, D2.
- **Needs:** 6, 7, 9. **Parallel with:** 12.
- **Decisions:**
  - Reserved slots and parity. Accepted 2026-11-22: ship a command for every reserved slot now, so parity stays strict and an AI can fill data before the UI exists.
  - Upgrading a box whose `lt` is below its `pt`. Accepted 2026-11-22: WT becomes 0 and the import outcome names the box.
  - Default edge type for upgraded files. Accepted 2026-11-22: `push`, the VSM default arrow.
  - Plain box fields (owner, team, performer and so on) in 1.0.0. Accepted 2026-11-22: yes; N1 needs owner, and bundling avoids more bumps.
  - Display rounding within a unit. Accepted 2026-11-22: round down, as today's formatter does; edit fields show the exact value.
  - Slots for rows 19–23. Accepted 2026-11-22: reserve rework rate, split ratio, batch size, end markers, map name and copied-from here, so those rows add no bump.

## Row 14 · E3b Canvas and data box

- **UI surfaces:** a toolbar (add box; E5 adds undo and redo here). Add, edit and delete boxes, connect and disconnect, a queue triangle in front of each box, and a data box under each process box, laid out like the horizontal worked example. LT is computed, never typed. Duration fields accept compact input ("90m", "2h", "3d") and labels use the new display rule. The total lead time tile shows the critical path. No 15-box warning. Canvas, data box and units help pages; glossary adds WT, week and month.
- **Save file:** none; E3a defined every field.
- **Commands, MCP, `llms.txt`:** the UI edits through E3a's commands via R4. Drag positions stay UI-only.
- **Catalog and guides:** no new codes expected; command problems show inline by field through R4's problems surface.
- **Usage and routes:** event `map-edited`, once per project open.
- **Shared files:** `App.jsx`, `StepCard.jsx` (becomes box plus data box), `MetricsBar.jsx`, `metrics.js` (critical path), `useProject.js`, `connections.js`, `glossary.js`, help pages, `e2e/shell.spec.js`, `e2e/views.js`. Merge first: E3a, R4, N17 frame, N14.
- **Needs:** 13, 6, 10, 11 (adds its event to N14's list). **Parallel with:** —.
- **Decisions:**
  - The time ladder view. Default: canvas only here; the prototype decides when the ladder comes.
  - A keyboard path for connecting boxes (deferred from ui-shell). Accepted 2026-11-22: in this item, since canvas CRUD is the keyboard surface.
  - Edit-in-place or a side panel for box fields. Default: the prototype decides.

## Row 15 · Project settings and default thresholds (no issue yet)

- **UI surfaces:** a Settings dialog from the project header: variability (25%), forecast trials (1,000), and the product plan's thresholds table in its three groups, each row with Good, Warning, Critical and its basis, editable with "Reset to default". Office projects hide the pipeline and DORA groups. Tiles migrate to the plan table: "Flow efficiency" becomes "Activity ratio" (25/10/5%), "First pass yield" becomes "Rolled %C&A" (60/30/15%), "Total queue" stays provisional at 20/50. Settings help page.
- **Save file:** optional `project.settings { variability, trials, thresholds }`. `thresholds` holds overrides only, keyed by measure, each `{ good, warning, critical, source }`; durations in minutes. Minor bump 1.0.0 → 1.1.0: fixture, a second fixture with settings set, hop, JSON Schema, plugin rebuild, `PROJECT_FIELDS`.
- **Commands, MCP, `llms.txt`:** `set_project_settings` (variability, trials), `set_threshold`, `reset_threshold`; read-only tool `get_thresholds` returns the effective table (defaults plus overrides). `llms.txt` gives each measure's key, unit and direction.
- **Catalog and guides:** new `SETTINGS_` area: variability or trials out of range, unknown measure, bands out of order, override without a source. Each gets a guide.
- **Usage and routes:** no route. Event `threshold-edited`.
- **Shared files:** new `src/flow/thresholds.js` (default table and rating), `metrics.js` (its `THRESHOLDS` and `rateMetric` move out), `MetricsBar.jsx`, `glossary.js`, `project.js`, `projectFile.js`, `src/flow/schema/*`, `src/flow/commands/`, `mcp/tools.js`, `public/schema/`, `public/llms.txt`, `plugin/`. Merge first: E3b. First schema bump after E3a.
- **Needs:** 14. **Parallel with:** 17.
- **Decisions:**
  - Store the whole table or overrides only. Accepted 2026-11-22: overrides only, so a quarterly change to a default reaches every project that did not override it.
  - Values between Good and Warning (activity ratio 10–25%, for example). Accepted 2026-11-22: rate them "Watch", like the Warning band; only Critical is "Needs attention".
  - Tile status words. Accepted 2026-11-22: keep "On target / Watch / Needs attention"; rename only the two tiles above.
  - Trials as a setting. Accepted 2026-11-22: yes, here, so E11 adds no bump.
  - Thresholds per project type. Accepted 2026-11-22: one table; office hides the groups it does not use.

## Row 16 · N1 (#39) Map-health core

- **UI surfaces:** a map-health score beside the summary metrics and a Map health panel listing findings by box, built on R4's problems surface; selecting a finding focuses its box. Findings never block an edit or a save. Each links to its D3 problem page and shows "Works with: aie-guide". Map health help page.
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** a `map-health` gate in `GATES`, reached through `list_problems { gate: "map-health" }`. No new command. `llms.txt` lists the gate, its codes and that it reads the thresholds table. `aie-guide` explains each finding.
- **Catalog and guides:** new `MAP_` codes: box missing WT, queue, %C&A or owner; automated box with no queue; too many boxes (reads "Boxes on one map": over 15, over 30). Missing data is a `warning`; a threshold breach is a `warning` in the Critical band and a `hint` in the Warning band. Guides in `aie-guide` and `aie-review`; D3 pages generate from the catalog.
- **Usage and routes:** no route. Event `map-health-viewed`, once per project open.
- **Shared files:** `src/flow/gates/index.js`, new `src/flow/gates/mapHealth.js`, `thresholds.js` (row 15), `catalog.json`, R4's problems surface, `MetricsBar.jsx`, `public/llms.txt`, `plugin/skills/`. Merge first: row 15, R4. E6, N4, N7, N15 and N2 add their own `MAP_` checks later.
- **Needs:** 14, 15, 6. **Parallel with:** 17.
- **Decisions:**
  - Score formula. Accepted 2026-11-22: the share of boxes with no `warning` finding, as a percent; map-level findings show in the panel but do not move the score.
  - Gate `ok` when only warnings are found. Accepted 2026-11-22: keep today's contract (`ok` is false when any problem is listed); only the app treats map health as advisory.
  - Dismissing a finding ("not applicable"). Accepted 2026-11-22: not in MVP; it would need a save-file field.
  - Fewer than 5 boxes. Accepted 2026-11-22: no finding; a new map starts empty.

## Row 17 · E5 (#31) Undo/redo

- **UI surfaces:** Undo and Redo buttons in E3b's toolbar, disabled when there is nothing to undo. Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y; inside a text input the browser's own undo wins. The announcer reads what was undone from the command summary ("Undid: added Code review"). Undo help page and shortcut list.
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** history is a pure list of project snapshots taken from successful command results, under `src/flow/`. Undo and redo are UI-only, flagged out of MCP. No `llms.txt` change.
- **Catalog and guides:** none expected; an empty history disables the button rather than raising a problem.
- **Usage and routes:** no route. Event `undo-used`, once per project open.
- **Shared files:** new `src/flow/history.js`, `session.js` (change count), `useProject.js`, E1's store write, the E3b toolbar, `App.jsx` (shortcuts), help pages, `e2e/`. Merge first: E3b, R4, E1.
- **Needs:** 14, 6, 8. **Parallel with:** 15, 16.
- **Decisions:**
  - History across sessions. Accepted 2026-11-22: current session only (issue default); opening, importing or switching a project clears it.
  - History depth. Accepted 2026-11-22: 100 steps.
  - Box moves. Accepted 2026-11-22: a drag end is one undoable entry, though positions stay UI-only.
  - Undo and the store. Accepted 2026-11-22: an undo is a change like any other; it writes the store and counts as unsaved.

## Row 18 · N16 (#30) + N8 (#36) Metric cells

- **UI surfaces:** each data-box cell (PT, WT, %C&A) takes low, typical and high and shows "2–5 d" with typical marked; a missing low or high shows dimmed, derived from the project variability. Each cell takes a source (estimate, interview, timestamps, tool status) and a confidence (low, medium, high). Tiles show typical with the range beside it, rolled %C&A included. Slice 2: a metric-definitions panel (lead time, cycle time, change lead time) with start and stop events. Ranges and definitions help pages.
- **Save file:** the metric slots are reserved by E3a, so ranges, source and confidence add no bump. Definitions add `project.metricDefinitions[]`, each `{ metric, start, stop }`; an end names a box, its start or end, and event text. Minor bump 1.1.0 → 1.2.0.
- **Commands, MCP, `llms.txt`:** `set_step_metrics` already takes the reserved slots (E3a). Add `set_metric_definition` and `clear_metric_definition`. `llms.txt` defines low and high, the source and confidence values, and the definitions.
- **Catalog and guides:** a definition naming an unknown metric or box; each gets a guide.
- **Usage and routes:** no route. Events `range-entered` and `definition-edited`, once per project open.
- **Shared files:** `StepCard.jsx` (data box), `MetricsBar.jsx`, `metrics.js` (ranges, all low to all high on the critical path), the units module, `thresholds.js` (variability), `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: rows 15 and 17.
- **Needs:** 14, 15, 17. **Parallel with:** —.
- **Decisions:**
  - What "high" means. Accepted 2026-11-22: P90, a bad but realistic case (issue default); "low" is P10.
  - Derived low and high. Accepted 2026-11-22: computed from variability when read and never written, so the file holds only what someone entered.
  - The low ≤ typical ≤ high rule. Accepted 2026-11-22: E3a's validator owns it; adding it here would make saved files invalid without a major bump.
  - Definition defaults. Accepted 2026-11-22: computed (lead time from the first box's start to the last box's end) and stored only once edited.

## Row 19 · E6 (#32) Rework loops

- **UI surfaces:** a dashed rework line below the boxes, from the box that finds the problem back to an earlier box, labelled with its rate (% of items) and the time it adds. Drawn by connecting backwards or with a box's "Add rework" action, with a keyboard path. The reworked box shows expected effort, PT × (1 + rate). Rework help page.
- **Save file:** `edges[].type: "rework"` and `edges[].rate` (an integer percent) are reserved by E3a, so no bump.
- **Commands, MCP, `llms.txt`:** `connect` gains `type` and `rate`; add `set_edge_rate`. The loop rule, `connect`'s checks, `layout.js` and the MCP save layout (`session.js`) apply to forward edges only. `llms.txt` describes rework edges and that their time is computed.
- **Catalog and guides:** rework pointing forward, an invalid rate, a rate on a non-rework edge. `MAP_` checks: rate over the threshold (10%, 25%) and a rate that disagrees with %C&A (`hint`). Each gets a guide.
- **Usage and routes:** no route. Event `rework-added`.
- **Shared files:** `src/flow/connections.js`, `commands/connections.js`, `layout.js`, `session.js`, the canvas edge component, `metrics.js`, `gates/mapHealth.js`, `catalog.json`, `src/flow/schema/*`, `public/llms.txt`, `plugin/`. Merge first: rows 16 and 18.
- **Needs:** 14, 15, 16. **Parallel with:** —.
- **Decisions:**
  - Time a loop adds. Accepted 2026-11-22: computed (rate × lead time of the boxes the loop repeats), never typed, like LT.
  - Which %C&A a rate is checked against. Accepted 2026-11-22: the box the loop starts from, within 10 points; this matches the worked example (review 85% with 20%, security 70% with 30%).
  - Rework in total lead time. Accepted 2026-11-22: left out, so the worked example's typical 283 h holds; E11 samples rework.

## Row 20 · N4 (#34) End markers

- **UI surfaces:** "Deployed" and "Released" markers placed after a box on each map; office projects label them "Decision made" and "Customer has the outcome". Tiles for change lead time and deploy to release, rated by the thresholds table. End markers help page.
- **Save file:** `maps[].endMarkers { deployed, released }`, each a box id, reserved by E3a, so no bump.
- **Commands, MCP, `llms.txt`:** `set_end_marker { marker, stepId, mapId? }` and `clear_end_marker`. `llms.txt` defines both markers and how change lead time is measured.
- **Catalog and guides:** a marker on an unknown box; Released upstream of Deployed. `MAP_` check: no end markers (`warning`). Each gets a guide.
- **Usage and routes:** no route. Event `end-marker-set`.
- **Shared files:** `metrics.js`, `MetricsBar.jsx`, `thresholds.js`, the canvas, `gates/mapHealth.js`, `catalog.json`, `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: row 16 (its check), row 18 (definitions).
- **Needs:** 14, 15, 16, 18. **Parallel with:** —.
- **Decisions:**
  - Where change lead time starts. Accepted 2026-11-22: the start in N8's change-lead-time definition; with none set, the tile says "Set a start" instead of a number.
  - Only Deployed set. Accepted 2026-11-22: Released is taken as the same point, deploy to release shows 0, and the N1 finding stays until both are placed.
  - Markers as nodes or box references. Accepted 2026-11-22: box references, so no new node type and no layout change.

## Row 21 · N7 (#35) Batches and schedules

- **UI surfaces:** the data box shows the trigger (continuous, scheduled with interval, on demand) and the wait it adds ("+½ wk"). A push arrow out of a batching box uses the striped VSM icon with the batch size. Batches and schedules help page.
- **Save file:** the trigger and `batchSize` (integer, 1 or more) are reserved by E3a, so no bump.
- **Commands, MCP, `llms.txt`:** E3a's trigger command; add `set_batch_size`. `llms.txt` states the half-interval rule in working minutes (weekly, 2400, adds 1200).
- **Catalog and guides:** an invalid batch size. `MAP_` checks: interval over the threshold (weekly, monthly), batch size over the threshold (5, 20), and a typed WT below half the interval (`hint`). Each gets a guide.
- **Usage and routes:** no route. Event `schedule-set`.
- **Shared files:** `StepCard.jsx`, the canvas edge component, `metrics.js`, the units module, `gates/dataComplete.js`, `gates/mapHealth.js`, `catalog.json`, `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: row 16 (its checks).
- **Needs:** 14, 15, 16. **Parallel with:** —.
- **Decisions:**
  - Typed WT and the schedule. Accepted 2026-11-22: with no typed WT, WT defaults to half the interval, shown as derived; a typed WT wins. The worked example's monthly intake (80 h) and weekly CAB (20 h) fit.
  - Derived WT and the gates. Accepted 2026-11-22: it counts as present for `data-complete` and N1.
  - Batch size on the box or the arrow. Accepted 2026-11-22: the box, drawn on its outgoing push arrow.

## Row 22 · N15 (#37) Units of work

- _Prototype first_: the handoff feeds the spec, and prototype code is not merged.
- **UI surfaces:** a unit picker on each box, unit bands above the boxes as in the worked example, and split and join markers with their ratio ("1 feature → 8 stories"). The join's wait shows as a batch of the ratio. A big-bang flag on the split. Units help page; glossary adds split and join.
- **Save file:** box `unit`, edge types `split` and `join`, and `edges[].ratio` (an integer) are reserved by E3a, so no bump.
- **Commands, MCP, `llms.txt`:** E3a's unit command; `connect` takes `ratio` for split and join. Lead time is counted in the first box's unit and ends when the last child reaches Released. `llms.txt` describes units, ratios and that rule.
- **Catalog and guides:** an invalid ratio, a join with no split, split and join ratios that differ (`hint`). `MAP_` checks: a unit change with no split or join, and big-bang delivery (both `warning`). Each gets a guide.
- **Usage and routes:** no route. Event `unit-split-added`.
- **Shared files:** `StepCard.jsx`, the canvas, `connections.js`, `layout.js`, `metrics.js`, `thresholds.js` (big-bang row), `gates/mapHealth.js`, `catalog.json`, `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: row 19 (forward-edge rules), row 20 (Released).
- **Needs:** 14, 15, 19, 20. **Parallel with:** —.
- **Decisions:**
  - Default units. Accepted 2026-11-22: idea, feature, story, change (PR), release, plus custom (issue default). E3a stores unit as text, so custom needs no bump.
  - Big-bang rule. Accepted 2026-11-22: a split ratio of 5 or more with a join wait over 1 week, added to the thresholds table as provisional.
  - Lead time across a split. Accepted 2026-11-22: the deterministic total adds the join wait once; E11 samples each child.

## Row 23 · E7 (#33) Current and future states

- _Prototype first_: the handoff feeds the spec, and prototype code is not merged.
- **UI surfaces:** a state switcher above the canvas (Current, then each future state). "Create future state" copies a map; rename and delete a future state (delete confirms). On a future state, each tile shows its change against the current state. States help page.
- **Save file:** `maps[]`, its `state`, `name` and `basedOn` (the map it was copied from) are reserved by E3a, so no bump.
- **Commands, MCP, `llms.txt`:** `copy_map { mapId, name }`, `rename_map`, `remove_map`; step commands already take `mapId`. `get_project` returns every map. `llms.txt` describes states and that box ids are unique within a map.
- **Catalog and guides:** new `STATE_` area (`MAP_` is N1's): map not found, deleting the current state, name empty or taken. Each gets a guide.
- **Usage and routes:** no new route. Event `future-state-created`.
- **Shared files:** `App.jsx`, `useProject.js`, `MetricsBar.jsx`, `metrics.js`, `gates/` (map health per map), `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: E3b.
- **Needs:** 14. **Parallel with:** —.
- **Decisions:**
  - "Related diagrams". Accepted 2026-11-22: lower-level process maps and pipelines wait for E9 (Phase 3); this item ships states only.
  - Copying. Accepted 2026-11-22: a deep copy that keeps box ids, so current and future boxes line up for the deltas.
  - State in the URL. Accepted 2026-11-22: no; the switcher remembers the last state this session.
  - A future-state gate for skills. Accepted 2026-11-22: waits for `aie-future-state` (Phase 2).

## Row 24 · N2 (#38) Outcome and guided start

- _Prototype first_: the handoff feeds the spec, and prototype code is not merged.
- **UI surfaces:** after create, a guided-start panel: outcome ("from X to Y by when"), a one-sentence scope with start and end triggers, sponsor, champion and work type. Then the whiteboard stages: scope, steps, time, quality, rework, review, future state; each marks done when its data exists. An outcome line in the header. "Works with: aie-facilitate" chip. Guided start help page.
- **Save file:** `project.outcome { metric, from, to, byWhen }` and `project.charter { scope, startTrigger, endTrigger, sponsor, champion, workType }`. Minor bump 1.2.0 → 1.3.0.
- **Commands, MCP, `llms.txt`:** `set_outcome`, `set_charter`, and an `outcome-set` gate for `aie-review`. Ships `aie-facilitate` in `plugin/skills/`; it works through MCP tools and never reads the save file. `llms.txt` describes both fields.
- **Catalog and guides:** an invalid outcome (unknown metric, bad date), an empty scope. `MAP_` check: no outcome (`warning`). Each gets a guide, `aie-facilitate` included.
- **Usage and routes:** no route. Events `guided-start-begun` and `outcome-set`.
- **Shared files:** E1's create dialog, `App.jsx`, `Header.jsx`, `project.js`, `projectFile.js`, `gates/`, `catalog.json`, `src/flow/schema/*`, `src/flow/commands/`, `public/llms.txt`, `plugin/`. Merge first: row 18 (schema order), row 23 (future-state stage).
- **Needs:** 8, 9, 14, 16, 18, 19, 23. **Parallel with:** —.
- **Decisions:**
  - App or skill. Accepted 2026-11-22: the app runs the stages; the skill does the interviewing and judgment (issue default).
  - The outcome's shape. Accepted 2026-11-22: a metric key and numbers in its unit, so E8 and E10 can chart progress with no bump.
  - The data-first path. Accepted 2026-11-22: hidden until E12's imports exist (Phase 3).
  - Stage progress in the file. Accepted 2026-11-22: no; it is read from the data.

## Row 25 · N17 (#41) Worked-example sample

- **UI surfaces:** "Start from the worked example" in E1's create dialog, which creates a new project from the sample. A help page walks through it beside `docs/product/worked-example-vsm.html`.
- **Save file:** none new. The sample is a project file at the current schema with the plan's 10 boxes (hours × 60), ranges, owners, units, split and join, rework, schedules, end markers, the outcome and the 8-box future state.
- **Commands, MCP, `llms.txt`:** none. The sample is published at `public/samples/worked-example.json`, and `llms.txt` links it as a complete example file.
- **Catalog and guides:** none. The DoD test "sample still opens and computes" fails when the sample does not validate or its numbers drift.
- **Usage and routes:** no route. Event `sample-opened`.
- **Shared files:** E1's create dialog, help pages, `public/samples/`, a new test under `src/flow/`, `public/llms.txt`, `.claude/CLAUDE.md` (DoD line). Merge first: rows 18–24.
- **Needs:** 10, 18, 19, 20, 21, 22, 23, 24. **Parallel with:** —.
- **Decisions:**
  - Numbers the test pins. Accepted 2026-11-22: typical lead time 283 h, rolled %C&A 13%, activity ratio 12.4%, change lead time 85 h; E11 adds the forecast.
  - Keeping it current. Accepted 2026-11-22: it stays at the version it was written in and upgrades on open, so it doubles as an upgrade test; never hand-edited.
  - The hotfix bypass. Accepted 2026-11-22: left out until N5 (Phase 2).

## Row 26 · E11 (#40) Monte Carlo v2

- **UI surfaces:** a forecast panel with P50 (typical), P85 (likely worst), P95 (rare worst) and the mean, a small histogram, and the boxes that contribute most to P85. It runs on open and from a "Run forecast" button. Forecast help page.
- **Save file:** none; results are derived. Variability and trials come from row 15's settings.
- **Commands, MCP, `llms.txt`:** read-only tool `get_forecast { mapId? }`, so skills quote the app's numbers. `llms.txt` describes the model and that the app's numbers win.
- **Catalog and guides:** no path to forecast (no boxes, or no start-to-end path); missing ranges filled from variability (`hint`). Each gets a guide.
- **Usage and routes:** no route. Event `monte-carlo-run`.
- **Shared files:** new `src/flow/forecast/`, `metrics.js` (critical path), the units module, `thresholds.js`, `MetricsBar.jsx`, `mcp/tools.js`, `catalog.json`, `public/llms.txt`, `plugin/`, the sample test. Merge first: row 25.
- **Needs:** 15, 18, 19, 20, 21, 22, 25. **Parallel with:** —.
- **Model:** PT and WT sampled separately; schedules 0 to the interval; rework repeats from rates; parallel groups take the slowest branch; a join waits for its last child. Resampling measured timestamps waits for N12 (Phase 3).
- **Decisions:**
  - Distributions. Accepted 2026-11-22: PT from a PERT on low, typical and high; WT right-skewed (lognormal) with typical as the median and high as P90.
  - Repeatable numbers. Accepted 2026-11-22: a fixed seed, so the same map gives the same forecast and tests are stable.
  - Acceptance. Accepted 2026-11-22: the worked example within 5% of 350 / 438 / 503 h. Then dogfood the Phase 1 gate.

## Row 27 · Autosave (optional)

- **UI surfaces:** in Chrome and Edge, "Link to a file" binds the open project to a local file and writes it after every command. When the file changes on disk, a "Reload changes" banner appears; nothing is overwritten silently. Elsewhere the control is hidden and import and export remain. Autosave help page, including the `./projects` folder the MCP server uses.
- **Save file:** none. Autosave writes the export form, `contentHash` included, so a reload spots hand edits and shows the AI notice for `modifiedBy`.
- **Commands, MCP, `llms.txt`:** UI-only. Reload runs the import pipeline (validate, then upgrade). `llms.txt` notes that the app reloads a file a tool writes.
- **Catalog and guides:** permission denied, file handle lost, file changed on disk while there are unsaved edits. A write failure reuses `FILE_SAVE_FAILED`. Each new code gets a guide.
- **Usage and routes:** no route. Event `file-autosave-enabled`.
- **Shared files:** E1's store (keeps the file handle), `useProject.js`, `session.js`, `importFlow.js`, `ImportStatus.jsx`, `Header.jsx`, help pages, `catalog.json`. Merge first: E3a, R4, E1.
- **Needs:** 8, 13, 6. **Parallel with:** —. Starts only if dogfooding (row 26) shows a need.
- **Decisions:**
  - Spotting changes. Accepted 2026-11-22: check the file's modified time every 2 s while the tab is visible; the API has no file watch.
  - Edits on both sides. Accepted 2026-11-22: the banner offers "Reload theirs" or "Keep mine"; nothing merges.
  - Which copy wins. Accepted 2026-11-22: the linked file; the store keeps a copy for the homepage.

## Order questions

Resolved 2026-11-22; the table in `plans/mvp-order.md` is updated. Rows 20 and 21 now need row 16, row 25 needs row 24, and E3a (row 13) reserves the slots for rows 19–23, so those rows add no bump.
