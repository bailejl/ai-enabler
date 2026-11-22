# MVP dependency cards (rows 8–14)

**Created**: 2026-11-22. Source: `plans/mvp-order.md` v2, the product plan, `plans/ai-contract.md`, `docs/specs/*.md`, `docs/schema-versioning.md`, issues #26–#41, and the code under `src/flow` and `src/shell`.

A card lists what an item touches and what must land first. It is not a spec: `/dev-team:specs` writes the full spec when the item starts, with the card as input. Each open decision has a recommended default; the spec confirms or changes it. Schema versions assume E13 PR2 ships 0.1.0.

## Row 8 · E1 (#27) Homepage

- **UI surfaces:** home route `#/` with the project list, sortable by name and date modified. Create dialog (name only). Per-card open, rename, duplicate, delete (confirm via `ConfirmDialog`), import and export. Header link back home. An unknown `#/projects/<id>` shows a "project not found" state with a link home.
- **Save file:** no field change, no bump. IndexedDB holds each project's save-file text; an index holds `{ id, name, modifiedAt }`. Opening a stored file runs the import pipeline (validate, then upgrade), so old stored files upgrade on open.
- **Commands, MCP, `llms.txt`:** create and rename go through commands (R4). List, open, duplicate and delete are store operations, flagged UI-only. No `llms.txt` change.
- **Catalog and guides:** new `STORE_` area: store unavailable (private mode or blocked), write failed (quota), project not found, stored file invalid. Each gets a guide (D2).
- **Usage and routes:** no new routes. `project-created` is wired by N14 (row 11), not here.
- **Shared files:** `src/shell/useProject.js` (starter project becomes a store load), `App.jsx`, `routes.js`, `Header.jsx`, `ConfirmDialog.jsx`, `src/flow/importFlow.js`, `e2e/shell.spec.js` ("stores nothing" test replaced; ui-shell AC27 retired). Merge first: R4, D2.
- **Needs:** 6, 7. **Parallel with:** —.
- **Open decisions:**
  - When to write the store. Default: after every successful command, so nothing is lost on reload.
  - What a new project holds. Default: an empty map with a one-line hint; the six starter steps go away.
  - Store text with or without `contentHash`. Default: with, so a stored file is a real export and opens without the "edited" notice.
  - Import id clashes. Default: per-card import replaces that card's project and keeps its id; a homepage import keeps the file's id unless it is taken, then gets a new one.
  - Duplicate name. Default: "<name> (copy)".
  - Rename over MCP. Default: yes, add `rename_project`; the name is a save-file field.
  - Two tabs on one project. Default: last write wins; help says so.

## Row 9 · E2 (#28) Project type

- **UI surfaces:** a required Software / Office picker in E1's create dialog. A type badge on each project card and in the header. "Duplicate as office/software" in the card menu.
- **Save file:** `project.type`, `software` or `office`. Minor bump 0.1.0 → 0.2.0: fixture `0.2.0.json`, upgrade hop, `public/schema/project-0.2.0.json`, plugin rebuild, `PROJECT_FIELDS` in `projectFile.js`.
- **Commands, MCP, `llms.txt`:** `create_project` gains `type`. No command changes type, which satisfies parity through `create_project`. `llms.txt` gives the field, its values and that it is fixed. Skills declare schema major 0.
- **Catalog and guides:** unknown project type (validator) and invalid `type` argument (command), each with a guide.
- **Usage and routes:** none.
- **Shared files:** `src/flow/project.js`, `projectFile.js`, `schema/version.js`, `schema/upgrades.js`, `schema/validate.js`, fixtures, `src/flow/commands/`, `public/schema/`, `public/llms.txt`, `plugin/`, E1's create dialog and card. Merge first: E1. Schema-serial with E3a.
- **Needs:** 8. **Parallel with:** 10.
- **Open decisions:**
  - Type for files without one. Default: the upgrade hop sets `software`; every map so far is idea to production.
  - `type` on `create_project`. Default: optional, defaulting to `software`, so 0.1.0 clients keep working.
  - Picker default. Default: Software preselected.
  - Profile extras now. Default: none. DORA, takt, FTE, systems-per-box and the office-to-software link ship with the items that use them.

## Row 10 · N17 (#41) Help frame

- **UI surfaces:** routes `#/help` and `#/help/<page>`. Pages for every shipped item (canvas basics, connect and delete, metrics tiles, import/export, homepage, AI tools and the MCP server), a VSM primer, a glossary page from `glossary.js`, skill install steps for the plugin, and "Works with: aie-…" chips on features that use a skill. The Help menu links into these pages. The footer shows the app version and links `CHANGELOG.md` (D1).
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** none. `llms.txt` links the primer and glossary.
- **Catalog and guides:** none. An unknown help page rewrites to `#/help`, like today's route rewrite. Leaves a `#/help/problems/<code>` slot for D3.
- **Usage and routes:** new templates `/help` and `/help/:page` (page names are a fixed set, so they are safe to count). N14 adds them.
- **Shared files:** `src/shell/routes.js`, `useRoute.js`, `App.jsx`, `HelpMenu.jsx`, `glossary.js`, `Header.jsx`. Merge first: E1 (home link), E13 PR3 (plugin install steps), D1 (app version).
- **Needs:** 8, 5, 4. **Parallel with:** 9. E2's help page lands in whichever of the two merges second.
- **Open decisions:**
  - Help inside the SPA or a docs site. Default: inside the SPA, so it works offline and matches the app version (issue default).
  - Page format. Default: plain JS content modules under `src/shell/help/`, no Markdown dependency.
  - Screenshots. Default: none in the frame; add them later from Playwright captures.

## Row 11 · N14 (#26) GoatCounter

- **UI surfaces:** a Privacy help page (`#/help/privacy`) with the note, the opt-out control, and why counting is off when GPC or Do Not Track is set. The control is keyboard operable and announced. Spec: `docs/specs/goatcounter.md` (parked), revised as below.
- **Save file:** none. The opt-out is a `localStorage` preference, not exported and not in `llms.txt`.
- **Commands, MCP, `llms.txt`:** none. No counting in the MCP server or skills.
- **Catalog and guides:** one code, `USAGE_SEND_FAILED`, severity debug: a coded D1 record, rate-limited, never shown in the UI. Its guide says no action is needed (ad blockers block it). This replaces the spec's "no catalog code" inference.
- **Usage and routes:** route templates `/`, `/projects/:id`, `/help`, `/help/:page`. Events for features that exist now: `project-created`, `project-imported`, `project-exported`, `skill-install-clicked`. The rest of the issue's list is reserved for later items. Production origin only; nothing from dev, preview, e2e or forks.
- **Shared files:** new `src/shell/usage.js` (pure) and a sender, `useRoute.js`, the help frame, call sites in `useProject.js` and E1's store, `catalog.json`. Merge first: E1, N17 frame, D1.
- **Needs:** 8, 10, 4. **Parallel with:** —.
- **Open decisions:**
  - How counts are sent. Default: our own few lines posting to GoatCounter's endpoint, with no third-party script. A compromised CDN script could read the map.
  - GPC and Do Not Track. Default: treat them as an opt-out.
  - Site code. Default: `ai-enabler.goatcounter.com`, created by you before the first deploy; the code sits in source, it is not a secret.
  - `help-opened` event. Default: drop it; `/help/:page` views already count help use.

## Row 12 · D3 Access, export, docs

- **UI surfaces:** a "Report a problem" help page with a "Copy diagnostics" button that copies the session's recent coded records as JSONL (redacted by D1's allow-list), with a download fallback. Generated pages at `#/help/problems/<code>`, one per catalog code, from `catalog.json` and the D2 guides. Each problem in the import list and R4's problems surface links to its page.
- **Save file:** none.
- **Commands, MCP, `llms.txt`:** no commands. `llms.txt` links the problems index. Dev-only access: D1's console records, read through Chrome DevTools MCP, with a help page on connecting it; no global API in production builds.
- **Catalog and guides:** one code for a blocked clipboard, with a guide. A test fails on any code with no generated page.
- **Usage and routes:** template `/help/problems/:code` (codes are a fixed set). Event `diagnostics-copied`.
- **Shared files:** `catalog.json`, D2 guide files, the help registry, `routes.js`, `ImportStatus.jsx`, R4's problems surface, D1's record buffer, the Vite build (page generation). Merge first: N17 frame, D1. Builds alongside E3a; both touch `catalog.json`, so merge one at a time.
- **Needs:** 10, 4. **Parallel with:** 13.
- **Open decisions:**
  - Where "Copy diagnostics" lives. Default: the "Report a problem" help page, linked from the Help menu.
  - How many records it copies. Default: the last 200 from this session.
  - Docs links in MCP results. Default: no; keep D3 out of `mcp/`, and let the catalog's docs anchor carry the link.

## Row 13 · E3a (#29) Schema v1 contract

- _Prototype first_: one prototype covers E3a and E3b; the handoff feeds both specs, and prototype code is not merged.
- **UI surfaces:** none new. Current cards and tiles keep working: they read `wt` and show LT = WT + PT. The import outcome names any box whose WT was clamped by the upgrade.
- **Save file:** major bump 0.2.0 → 1.0.0. `pt`, `wt`, `ca` become metric objects `{ typical, low?, high?, source?, confidence? }`. `wt` replaces `lt` (hop: `wt = lt − pt`). Nodes and edges move into `maps[]`, the first map with state `current`. `edges[].type` is added. Boxes gain `unit` and `trigger { type, interval }`, plus description, owner role, team, headcount, performer, WIP and oldest item. Durations are integer minutes. Fixture `1.0.0.json`, hop, `project-1.0.0.json`, plugin rebuild.
- **Units module:** one pure module for 1h = 60, 1d = 480, 1w = 2400, 1mo = 9600, parse and format; it replaces `src/flow/duration.js`. E3b switches the display to it.
- **Commands, MCP, `llms.txt`:** `set_step_metrics` takes `wt` in place of `lt`; `update_step` takes the new box fields; trigger and unit commands are added. Step commands take an optional `mapId`. The `data-complete` gate checks `pt`, `wt`, `ca`, `queue`. `llms.txt` and `aie-guide` rewritten for v1; skills declare major 1 and warn on 0.x files.
- **Catalog and guides:** new codes for a non-integer duration, an unknown edge type, an invalid trigger or unit, and an empty or malformed `maps[]`. `MAP_` stays reserved for N1, so `maps[]` problems use `FILE_`. Each gets a guide.
- **Usage and routes:** none.
- **Shared files:** `src/flow/schema/*`, `step.js`, `projectFile.js`, `metrics.js`, `duration.js`, `initialFlow.js`, `src/flow/commands/`, `src/flow/gates/`, `mcp/`, `public/schema/`, `public/llms.txt`, `plugin/`, `StepCard.jsx`. Merge first: E2 (schema order), R4, D2.
- **Needs:** 6, 7, 9. **Parallel with:** 12.
- **Open decisions:**
  - Reserved slots and parity. Default: ship a command for every reserved slot now, so parity stays strict and an AI can fill data before the UI exists.
  - Upgrading a box whose `lt` is below its `pt`. Default: WT becomes 0 and the import outcome names the box.
  - Default edge type for upgraded files. Default: `push`, the VSM default arrow.
  - Plain box fields (owner, team, performer and so on) in 1.0.0. Default: yes; N1 needs owner, and bundling avoids more bumps.
  - Display rounding within a unit. Default: round down, as today's formatter does; edit fields show the exact value.

## Row 14 · E3b Canvas and data box

- **UI surfaces:** a toolbar (add box; E5 adds undo and redo here). Add, edit and delete boxes, connect and disconnect, a queue triangle in front of each box, and a data box under each process box, laid out like the horizontal worked example. LT is computed, never typed. Duration fields accept compact input ("90m", "2h", "3d") and labels use the new display rule. The total lead time tile shows the critical path. No 15-box warning. Canvas, data box and units help pages; glossary adds WT, week and month.
- **Save file:** none; E3a defined every field.
- **Commands, MCP, `llms.txt`:** the UI edits through E3a's commands via R4. Drag positions stay UI-only.
- **Catalog and guides:** no new codes expected; command problems show inline by field through R4's problems surface.
- **Usage and routes:** event `map-edited`, once per project open.
- **Shared files:** `App.jsx`, `StepCard.jsx` (becomes box plus data box), `MetricsBar.jsx`, `metrics.js` (critical path), `useProject.js`, `connections.js`, `glossary.js`, help pages, `e2e/shell.spec.js`, `e2e/views.js`. Merge first: E3a, R4, N17 frame.
- **Needs:** 13, 6, 10. **Parallel with:** —.
- **Open decisions:**
  - The time ladder view. Default: canvas only here; the prototype decides when the ladder comes.
  - A keyboard path for connecting boxes (deferred from ui-shell). Default: in this item, since canvas CRUD is the keyboard surface.
  - Edit-in-place or a side panel for box fields. Default: the prototype decides.
