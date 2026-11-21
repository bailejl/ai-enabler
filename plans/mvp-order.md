# MVP build order (Phase 1)

**Created**: 2026-11-21. Source: dev-team orchestrator, from `docs/product/ai-enabler-plan.md` and the approved `plans/ai-contract.md`.
**Decisions**: D1 stays after E13 PR2. No GitHub issues for the E13 plan.

Each item runs through the dev-team flow (`/dev-team:specs` → `/dev-team:plan` → `/dev-team:build` → `/pr`). Items marked _prototype first_ start with `/prototype start <name>`; the handoff feeds specs, and prototype code is not merged. "Parallel with" marks work that can run in its own worktree at the same time.

| #   | Item                               | What it is                                                                                                                                      | Needs              | Parallel with |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------- |
| 1   | N13 (#25)                          | Pages deploy, hash routes, base path                                                                                                            | —                  | 2             |
| 2   | E13 PR1                            | `plans/ai-contract.md` Slice 1: diagnostics catalog, validator returns every problem, import lists them                                         | —                  | 1             |
| 3   | E13 PR2                            | Slices 2–7: layout, schema 0.1.0, commands, gates, session and store, stdio MCP server                                                          | 2                  | —             |
| 4   | D1 Diagnostics core and gate       | Coded JSON console records (dev and prod), allow-list redaction, per-code rate limits, error boundary, a test gate that fails on uncoded errors | 3                  | 5, 6          |
| 5   | R4 UI on commands                  | React UI edits through the command layer; UI-only commands stay out of MCP                                                                      | 3                  | 4, 6          |
| 6   | E13 PR3                            | Slices 8–9: JSON Schema, `llms.txt`, `AGENTS.md`, parity test, plugin and skills; adds the diagnostics DoD rule                                 | 3                  | 4, 5          |
| 7   | D2 Repair guides                   | One guide per catalog code in `aie-review` and `aie-guide`                                                                                      | 6                  | 8             |
| 8   | E5 (#31) Undo/redo                 | History over command results                                                                                                                    | 5                  | 7, 9          |
| 9   | N14 (#26) GoatCounter              | Feature counts, no map data                                                                                                                     | 1                  | 8             |
| 10  | E2 (#28) Project type              | Software or office profile on one model                                                                                                         | 3                  | 9             |
| 11  | E1 (#27) Homepage                  | List, create, open, rename, duplicate, import/export                                                                                            | 10                 | —             |
| 12  | N17 (#41) Help                     | One page per feature, VSM primer, glossary, sample                                                                                              | 11                 | —             |
| 13  | D3 Access, export, docs            | Dev-only Chrome DevTools MCP access, "Copy diagnostics" JSONL, help pages from the catalog                                                      | 12, 4              | —             |
| 14  | E3 (#29) Canvas and data box       | _Prototype first._ One breaking schema bump: metric objects, WT replaces `lt`, `maps[]`                                                         | 5, 10              | —             |
| 15  | N16 (#30) Ranges                   | Low/typical/high, no schema bump                                                                                                                | 14                 | 16            |
| 16  | N8 (#36) Metric definitions        | Source and confidence on the same metric object                                                                                                 | 14                 | 15            |
| 17  | E6 (#32) Rework loops              | Back-edges; loop rule, `connect` and layout apply to forward edges only                                                                         | 14                 | 19, 20        |
| 18  | E7 (#33) Current and future states | _Prototype first._ Uses `maps[]`                                                                                                                | 14                 | —             |
| 19  | N4 (#34) End markers               | Deployed and Released                                                                                                                           | 14                 | 17, 20        |
| 20  | N7 (#35) Batches and schedules     | Interval adds half as wait                                                                                                                      | 14                 | 17, 19        |
| 21  | N15 (#37) Units of work            | _Prototype first._ Split and join markers                                                                                                       | 14                 | —             |
| 22  | N2 (#38) Outcome and guided start  | _Prototype first._ Ships `aie-facilitate`                                                                                                       | 11, 14             | —             |
| 23  | Default thresholds                 | Shared, editable per project, stores its source (no issue yet)                                                                                  | 14                 | 21, 22        |
| 24  | N1 (#39) Map-health checks         | Gates with `MAP_` catalog codes and guides                                                                                                      | 19, 21, 22, 23, 16 | —             |
| 25  | E11 (#40) Monte Carlo v2           | P50/P85/P95 from ranges, rework and schedules; then dogfood the Phase 1 gate                                                                    | 15, 17, 20         | —             |
| 26  | Autosave (optional)                | File System Access autosave and "Reload changes"; only if dogfooding shows a need                                                               | 11                 | —             |

Dropped: `window.aie` (D3 covers it) and "copy for AI".

## Rules that apply to every item

- A change that adds a save-file field adds its command, MCP tool and `llms.txt` entry (AC23 parity).
- A change that adds a failure mode adds its catalog code, repair guide and docs (after D1/D2).
- E3 must fix one canonical time unit (the app stores minutes; the worked example uses hours) before its schema bump.
- E12, N12 and skills that write the save file go through the validator and commands and set `modifiedBy`.
