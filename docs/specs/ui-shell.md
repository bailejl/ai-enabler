<!-- spec-version: dev-team 14.2.0 -->

# Spec: UI shell

**Format:** dev-team specs 14.2.0 (validate mode)
**Source:** [Prototype handoff: ui-shell](https://github.com/bailejl/ai-enabler/issues/10), the same text as `docs/prototypes/ui-shell.md`. The prototype code on `proto/ui-shell` is reference only and is not merged.

Citation keys:

- `[H §<section>]`: a section of the handoff.
- `[G]`: a decision made at graduation, recorded in the handoff's Decisions section.
- `[S<n>]`: answer n in this spec session's Ambiguity Log.
- `[Inferred]`: an inference, logged in the Ambiguity Log.

## Intent Description

Give ai-enabler a working app shell for one value stream map:

- A branded header that shows the project name and holds Import and Export.
- A help menu.
- A canvas of step cards that show each step's process time, lead time, quality, queue, and batch size.
- A metrics bar that summarizes the whole stream and flags areas of focus by status.

Metrics are always computed from the steps on the canvas, so the cards and the bar never disagree.

The map can be exported to a JSON file whose schema version follows SemVer, starting at `0.0.0`, and imported back. Import accepts every released schema version and upgrades the data to the current version. CI checks every upgrade path. Importing a file replaces the map, and the app always asks first.

The app keeps one project in memory. A reload returns to the starter project.

The shell meets WCAG 2.1 AA, with one exception: a keyboard path for creating connections is deferred to its own spec.

These items are out of scope, and each gets a separate spec:

- Step editing, adding steps, and renaming the project.
- Saving the map across reloads, and keeping several projects (switch, new, delete).
- The keyboard connect path.

## Architecture Specification

**Components.** These are named for responsibility; `/plan` chooses files.

1. **Shell layout.** A header, a left menu, and a canvas area. The canvas area holds the React Flow canvas with the metrics bar below it.
2. **Header.** Shows the project name and holds the Import and Export controls.
3. **Help menu (left).** Collapsible sections: How to use, Glossary, and Help.
4. **Step card.** A custom React Flow node, made of these parts:
   - Title.
   - PT, LT, and %C&A rows.
   - Queue badge in the upper left.
   - Batch badge in the upper right.
   - One target handle on the left and one source handle on the right.
5. **Connection rules.** Pure functions that decide whether a proposed connection is valid.
6. **Flow metrics.** Pure functions that do the following:
   - Compute each metric from the steps.
   - Rate each metric against its thresholds.
   - Format durations.
7. **Project file.** Pure functions that do the following:
   - Serialize the project to the versioned JSON format.
   - Parse an import file and validate its shape and types.
   - Derive the export file name.
8. **Schema upgrades.** An ordered registry of pure upgrade functions. Each one takes data at one released schema version to the next. A fixture file for every released version proves the chain.

**Constraints.**

- Code style follows `.claude/CLAUDE.md`:
  - JavaScript ES modules, React 19 function components and hooks, `@xyflow/react` 12.
  - Functional style: no classes and no `this`.
- The logic for components 5–8 lives in plain modules under `src/flow/`. It has Vitest unit tests and runs without rendering. [Inferred: `.claude/CLAUDE.md` "Keep value stream logic in plain functions under `src/flow/`"]
- Durations are stored as integer minutes. Display uses a working day: **1d = 8h = 480 min**. [G]
- The file format is `schemaVersion: "0.0.0"`, a SemVer string [S15], with these additions to H §Data shape:
  - `project.id`: the internal id [S6].
  - `data.batch` is optional [H §Data shape].
- No backend, no network calls, and no browser storage. [S2]
- The existing `src/flow/initialFlow.js` stays the source of the starter steps. Its tests keep passing, or change with it.

- The repo has no CI today. This spec adds a GitHub Actions workflow that runs on every pull request and every push to `main`, so the schema checks in AC45 run in CI. It has two jobs:
  - Lint and unit tests (`npm test`).
  - The Playwright e2e suite, including the axe scans. [S15, S17]

**Dependencies.** No new runtime dependencies are needed. `/plan` must justify any it adds. An axe test helper for AC40 is a dev dependency. SemVer parsing and comparison may use a small library or a local function; `/plan` decides.

## Acceptance Criteria

### Shell and header

- **AC1:** The header shows the app mark, the name "AI Enabler", a divider, the project name, and Import and Export controls aligned right. [H §Behavior 2]
- **AC2:** A project name of up to 100 characters truncates with an ellipsis. It does not wrap the "AI Enabler" brand or push Import and Export out of view at 1024px width. The full name is in the accessible name and a tooltip. [Inferred, from H §UX notes exploratory-testing "long project name wraps the brand"]
- **AC3:** The document title is `<project name> · AI Enabler`. [Inferred, from H §UX notes ui-ux-designer]

### Help menu

- **AC4:** The left menu has three collapsible sections, How to use, Glossary, and Help, with native disclosure semantics. Each section is collapsed by default. [H §Behavior 3, §Decisions]
- **AC5:** Glossary entries cover each term the UI shows: PT, LT, %C&A, Queue, Batch size, Flow efficiency, First pass yield, Total queue, and Avg process time. They use the Glossary table below. [Inferred, from H §UX notes ui-ux-designer]
- **AC6:** Menu entries are text content, not inert buttons. How to use and Help hold short placeholder text until real content is written. [Inferred, from H §UX notes ui-ux-designer]

### Step cards

- **AC7:** Each card shows the step title and three label/value rows: PT, LT, and %C&A. The abbreviations expand in the accessible text (process time, lead time, percent complete and accurate). [H §Behavior 4, §UX notes a11y 1.3.1]
- **AC8:** The queue badge shows the step's queue count in the card's upper-left corner. Its accessible name is "<n> items waiting". The badge does not render when the queue is 0 or absent. [H §Behavior 4, §Decisions]
- **AC9:** The batch badge shows the batch size in the upper-right corner only when the step has a batch value. Its accessible name is "Batch size <n>". [H §Behavior 4, §Decisions]
- **AC10:** Badge text meets 4.5:1 contrast against its fill, and the badge border meets 3:1. The queue badge stays yellow-family and the batch badge stays blue-family. [H §UX notes a11y 1.4.3]
- **AC11:** Card borders and shadows stay subdued. Edges and arrowheads meet 3:1 contrast against the canvas background. [H §Decisions, §UX notes 1.4.11]
- **AC12:** A card shows duration values in the format of AC22, and %C&A as an integer percent.

### Connections

- **AC13:** Connections go only from a card's right-side source handle to another card's left-side target handle, by pointer drag. Edges render with an arrowhead at the target. [H §Behavior 5, §Decisions]
- **AC14:** A handle with no connection is visually hidden. It becomes visible on pointer hover near it and while a connection drag is in progress. [H §Behavior 5]
- **AC15:** The app rejects these connections, and nothing changes:
  - A connection from a step to itself.
  - A duplicate of an existing source→target pair.
  - Any connection that would create a cycle in the step graph.

  [H §Decisions "No backward connections or cycles for now"]

- **AC16:** Branching is allowed. A step may have several outgoing and several incoming connections, subject to AC15. [S7]
- **AC17:** Deleting a step removes its connections. Deleting a connection re-hides any handle it frees, per AC14. Selected steps and connections are deleted with the Delete or Backspace key. [H §Behavior 8]

### Metrics bar

- **AC18:** The metrics bar shows seven tiles in this order: Total lead time, Total process time, Flow efficiency, First pass yield, Total queue, Avg process time, Steps. [H §Behavior 6, §Decisions]
- **AC19:** The tiles are computed from all steps on the canvas, whatever the connections are [S7]:
  - **Total lead time** = sum of LT.
  - **Total process time** = sum of PT.
  - **Flow efficiency** = total PT ÷ total LT × 100, to 1 decimal place.
  - **First pass yield** = product of each step's %C&A ÷ 100, × 100, to 1 decimal place.
  - **Total queue** = sum of queues.
  - **Avg process time** = total PT ÷ step count, rounded to the nearest minute.
  - **Steps** = step count.

  [H §Behavior 6, S13]

- **AC20:** Any change to steps (import or delete) updates every tile in the same render. Card values and tile values never disagree. [H §Decisions]
- **AC21:** Status ratings use these thresholds [H §Decisions "Thresholds"]:

  | Metric           | On target | Watch           | Needs attention |
  | ---------------- | --------- | --------------- | --------------- |
  | Flow efficiency  | ≥ 70%     | ≥ 20% and < 70% | < 20%           |
  | First pass yield | ≥ 70%     | ≥ 50% and < 70% | < 50%           |
  | Total queue      | < 20      | 20–50 inclusive | > 50            |

  Other tiles have no status.

- **AC22:** Durations display in the two largest units:
  - `Xd Yh` for at least 1 day. A zero part is dropped, so `Xd` is valid.
  - `Xh Ym` for at least 1 hour.
  - Otherwise `Xm`.

  One day is 480 minutes. For example, 600 min → `1d 2h`, 260 min → `4h 20m`, 45 min → `45m`. [H §Decisions, G]

- **AC23:** A rated tile shows its status as visible text ("On target", "Watch", "Needs attention") in addition to color. Each tile exposes its label and value as a term/description pair. [S3, H §UX notes a11y 1.4.1 and 1.3.1]
- **AC24:** All metrics-bar text meets 4.5:1 contrast, including on tinted status backgrounds. [S3, H §UX notes a11y 1.4.3]
- **AC25:** With zero steps, every tile shows "—" with no status, and the canvas shows an empty-map message. [S8]
- **AC26:** Metric labels and values stay aligned across tiles at 1024px and wider. Below 1024px the bar wraps to more than one row instead of clipping values. [H §UX notes ui-ux-designer]

### Project

- **AC27:** On every load, the app opens a starter project named "Untitled Project" with a new internal id. It uses the six starter steps with the sample data in the Starter data table. Nothing persists across reloads. [S2, S9, H §Behavior 1]

### Export

- **AC28:** Export downloads `<slug>.ai-enabler.json`. `<slug>` is the project name in lowercase, with runs of non-alphanumerics turned into single hyphens and the ends trimmed. The fallback is `project`. [H §Behavior 9]
- **AC29:** The file contains these fields, and no React Flow runtime fields:
  - `schemaVersion` set to the current schema version (`"0.0.0"` at launch) and `exportedAt` (ISO 8601).
  - `project: { id, name }`.
  - `nodes`: `id`, `type`, `position`, and `data`.
  - `edges`: `id`, `source`, and `target`.

  [H §Data shape, S6]

- **AC30:** Exporting and then importing the same file leaves steps, positions, connections, and all metric values unchanged. [H §Behavior 10]

### Import

- **AC31:** Import accepts a `.json` file. It checks `schemaVersion` first, then upgrades the data (AC42), then validates the whole upgraded file before changing anything:
  - `schemaVersion` is a valid SemVer string at or below the current schema version, and it is a released version (AC41).
  - `project.name` is a non-empty string.
  - `nodes` and `edges` are arrays.
  - Every node has a string `id`, a numeric `position.x` and `position.y`, and a `data.label` string.
  - Where present, `data.pt`, `data.lt`, `data.queue`, and `data.batch` are non-negative integers.
  - Where present, `data.ca` is a number from 0 to 100.
  - Node ids are unique.
  - Every edge references existing node ids.
  - The edges satisfy AC15.

  [H §UX notes exploratory-testing Critical and Major findings]

- **AC32:** If validation fails, nothing changes. An in-page error message, announced through a live region, names the first problem in plain terms, such as "Step 2 is missing a position." `null` and non-object JSON are reported as "not a project file", not as invalid JSON. [H §UX notes a11y 4.1.3, exploratory-testing]
- **AC33:** If the file's project name equals the open project's name, the app asks "Replace current map with the imported version of <name>?". On confirm, the map (steps, positions, connections) is replaced, the view re-fits, and the project id is kept. [S5, S16]
- **AC34:** If the file's project name differs from the open project's name, the app asks "Replace current map with <name>?". On confirm, the map, the project name, and the project id are replaced with the file's, and the view re-fits. [S5, S14]
- **AC35:** Cancelling either import confirmation changes nothing.
- **AC36:** The `project.id` in an imported file never decides matching. Matching is by name, per AC33–34. [S5, S6]
- **AC37:** Every outcome of an import (replaced, cancelled, or error) is announced in a polite live region. Focus returns to the Import control. [H §UX notes a11y 4.1.3]

### Schema versioning and upgrades

- **AC41:** The app defines one current schema version and a list of released schema versions. At launch both are `0.0.0`. Every version a released app has ever exported stays in the list. [S15]
- **AC42:** On import, the file's data passes through each upgrade function in order, from its `schemaVersion` to the current version. Validation (AC31) runs on the result. A file already at the current version passes through unchanged. [S15]
- **AC43:** A file whose `schemaVersion` is newer than the current version, or is not a released version, is rejected under AC32 with a message naming both versions. For example: "This file uses schema 0.3.0; this app supports up to 0.1.0." A missing or non-SemVer `schemaVersion`, including the prototype's numeric `1`, is reported as "not a project file". [Inferred]
- **AC44:** Every released schema version has a committed fixture file holding a representative project at that version. A unit test upgrades each fixture to the current version and asserts that the result passes validation (AC31) and matches the fixture's expected upgraded output. [S15]
- **AC45:** CI fails in any of these cases:
  - The current schema version has no fixture.
  - A released version has no upgrade path to the current version.
  - A fixture for a version already released on `main` was changed.
  - Export's output shape changed without a schema version bump. This is detected by a test that compares the starter project's export with the current version's fixture.

  The pre-push hook runs the same unit tests. [S15]

- **AC46:** Version bumps follow SemVer for data:
  - **Major:** a breaking change, such as a field removed, renamed, or its meaning changed.
  - **Minor:** a backward-compatible addition, such as a new optional field.
  - **Patch:** a fix with no shape change.

  Every bump, at any level, adds an upgrade function (identity is allowed) and a fixture. [Inferred, SemVer convention]

### Accessibility (cross-cutting)

- **AC38:** Every interactive control has a visible `:focus-visible` indicator of at least 3:1 against both the dark header and the light canvas and menu. [H §UX notes a11y 1.4.11 / 2.4.7]
- **AC39:** Import and Export have descriptive accessible names: "Import project (JSON)" and "Export project (JSON)". [H §UX notes a11y 2.4.6]
- **AC40:** An automated axe scan reports zero WCAG 2.1 A/AA violations on these views:
  - The default view.
  - The view with a help section expanded.
  - The view showing an import error.
  - The view with the import confirmation open.

  Keyboard creation of connections (2.1.1) is excluded until its own spec lands. [S3]

### Starter data (AC27)

| Step       | PT  | LT    | %C&A | Queue | Batch |
| ---------- | --- | ----- | ---- | ----- | ----- |
| Idea       | 2h  | 3d    | 90   | 20    | —     |
| Plan       | 6h  | 2d    | 90   | 3     | —     |
| Build      | 1d  | 2d 4h | 90   | 4     | —     |
| Test       | 4h  | 2d 4h | 90   | 5     | —     |
| Deploy     | 4h  | 1d 4h | 90   | 1     | —     |
| Production | 2h  | 1d    | 90   | 1     | 3     |

At 8-hour days, these values give the following metrics:

- Total LT `12d 4h`.
- Total PT `3d 2h`.
- Flow efficiency 26.0%, rated Watch.
- First pass yield 53.1%, rated Watch.
- Total queue 34, rated Watch.
- Avg process time `4h 20m`.
- Steps 6.

[S9, Inferred: values rescaled from H §Data shape so that hour values stay below 8h]

## Glossary

| Term                                 | Definition                                                                               | Status     | Source                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| Step                                 | A stage of the value stream, shown as a card on the canvas                               | `verified` | H §Behavior 1                                   |
| PT (process time)                    | Actual work time spent on an item at a step                                              | `verified` | User: "Total process time, actual work time"    |
| LT (lead time)                       | Elapsed time an item spends at a step, from arrival to departure, including waiting      | `verified` | User: "Total lead time ... end to end time"     |
| %C&A (percent complete and accurate) | Share of a step's output that needs no rework downstream                                 | `verified` | User: "the correct and accurate"                |
| Queue                                | Number of items waiting at a step                                                        | `verified` | User: "the number of items in the queue"        |
| Batch size                           | Number of items a step processes together                                                | `verified` | User: "denote the batch size for that ... card" |
| Flow efficiency                      | Total PT ÷ total LT                                                                      | `verified` | User; H §Behavior 6                             |
| First pass yield                     | Product of all steps' %C&A: the share of items that pass the whole stream without rework | `verified` | User; H §Decisions                              |
| Total queue                          | Sum of the queues of all steps                                                           | `verified` | User                                            |
| Avg process time                     | Total PT ÷ number of steps                                                               | `verified` | S13                                             |
| Working day (d)                      | 8 hours, used for all duration display                                                   | `verified` | G                                               |
| Project                              | A named value stream map with an internal id                                             | `verified` | S6                                              |

## Ambiguity Log

| Decision                                                                       | Classification               | Resolved By        | Rationale / Answer                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1. Are step editing and adding steps in scope?                                | `requires-stakeholder-input` | human              | Separate spec, done later. This spec has no editing.                                                                                                                                                                                                                    |
| S2. Does the map persist across reload?                                        | `requires-stakeholder-input` | human              | Separate spec. Here, nothing persists and a reload opens the starter project.                                                                                                                                                                                           |
| S3. What accessibility bar applies?                                            | `requires-stakeholder-input` | human              | WCAG 2.1 AA. The keyboard connect path is a separate spec, to design together.                                                                                                                                                                                          |
| S4. How does the user switch projects?                                         | `requires-stakeholder-input` | human              | Separate spec, together with S2.                                                                                                                                                                                                                                        |
| S5. How does import treat the current project?                                 | `requires-stakeholder-input` | human              | Rationale confirmed. A matching name replaces with no prompt; a different name asks first (S14).                                                                                                                                                                        |
| S6. What is a project's identity?                                              | `requires-stakeholder-input` | human              | Confirmed: an internal id, unique names, and import matches on name.                                                                                                                                                                                                    |
| S7. Is branching allowed?                                                      | `requires-stakeholder-input` | human              | Confirmed: allowed, and metrics sum over all steps.                                                                                                                                                                                                                     |
| S8. What does an empty map show?                                               | `requires-stakeholder-input` | human              | Confirmed: "—" with no status, plus an empty-map message.                                                                                                                                                                                                               |
| S9. What data do starter steps carry?                                          | `requires-stakeholder-input` | human              | Confirmed for now: the prototype sample, rescaled to 8-hour days.                                                                                                                                                                                                       |
| S10. Can the user create a new project?                                        | `requires-stakeholder-input` | human              | Separate spec, together with S2 and S4.                                                                                                                                                                                                                                 |
| S11. What happens when the user deletes the open project?                      | `requires-stakeholder-input` | human              | Answer for the projects spec: open the most recently used remaining project, or a starter project. Not in this spec.                                                                                                                                                    |
| S12. What if an import name matches a saved project that is not open?          | `requires-stakeholder-input` | human              | Answer for the projects spec: confirm the replace, then offer to switch. Not in this spec, which has one project.                                                                                                                                                       |
| S13. How is Avg process time defined?                                          | `requires-stakeholder-input` | human              | Total PT ÷ steps.                                                                                                                                                                                                                                                       |
| S14. With one project in memory, what does an import with a different name do? | `requires-stakeholder-input` | human              | Confirm "Replace current map with <name>?", then load it. The switch prompt moves to the projects spec.                                                                                                                                                                 |
| G1. How long is a day?                                                         | `requires-stakeholder-input` | human (graduation) | 8 working hours.                                                                                                                                                                                                                                                        |
| G2. Are backward connections and cycles allowed?                               | `requires-stakeholder-input` | human (graduation) | Not for now.                                                                                                                                                                                                                                                            |
| G3. How is a zero queue shown?                                                 | `requires-stakeholder-input` | human (graduation) | The bubble is hidden.                                                                                                                                                                                                                                                   |
| Scope split: release semantic versioning                                       | `requires-stakeholder-input` | human              | The user asked for SemVer app releases enforced during development. This is unrelated to the UI shell, so it gets its own spec per the Scope Split Protocol.                                                                                                            |
| I1. What counts as "backward": the graph or card position?                     | `inferable`                  | inference          | The user framed backward as "creating a loop", so the rule is graph-cycle based (AC15). Check passed: a position-based rule is ruled out, because a loop is a graph property.                                                                                           |
| I2. Is the first pass yield boundary at exactly 70% On target?                 | `inferable`                  | inference          | ≥ 70% is On target, the same as the flow efficiency rule ("below 70% yellow"). Check passed.                                                                                                                                                                            |
| I3. Are the queue boundaries at 20 and 50 inclusive?                           | `inferable`                  | inference          | The user said "20 to 50 yellow" and "above 50 red", so 20 and 50 are Watch. Check passed.                                                                                                                                                                               |
| I4. What is the duration format?                                               | `inferable`                  | inference          | The user said "days and hours or minutes depending on the scale". Check: no plausible alternative.                                                                                                                                                                      |
| I5. How is Avg process time rounded?                                           | `inferable`                  | inference          | To the nearest minute, so the display matches AC22 granularity. Check: no plausible alternative that changes display.                                                                                                                                                   |
| I6. Is %C&A an integer or a decimal?                                           | `inferable`                  | inference          | Cards show an integer percent. Import accepts any number from 0 to 100. Check: the alternative "reject decimals" is not ruled out, but only affects edge files. Revisit in the editing spec.                                                                            |
| I7. What does import validate?                                                 | `inferable`                  | inference          | Validate everything before applying, because the exploratory Critical and Major findings showed bad files crash the app or corrupt the metrics. Check: the alternative "drop invalid nodes" would hide data loss.                                                       |
| I8. Are there authentication, authorization, or audit requirements?            | `inferable`                  | inference          | None apply. This is a single-user, local-only app with no backend. Check: no plausible alternative inside this spec.                                                                                                                                                    |
| I9. Are there long-name and title rules?                                       | `inferable`                  | inference          | Truncate, and use the project name in the title (AC2, AC3), from the UX and exploratory findings. Low risk.                                                                                                                                                             |
| I10. What do the menu contents and Glossary entries say?                       | `inferable`                  | inference          | Glossary entries come from the Glossary table. How to use and Help hold placeholders. Check: the alternative "write full help copy now" is out of scope for a shell spec.                                                                                               |
| I11. What are the starter sample values at 8-hour days?                        | `inferable`                  | inference          | Hour values stay below 8h and total LT stays at 12d 4h. The exact numbers are illustrative.                                                                                                                                                                             |
| I12. Is the delete key binding a new rule?                                     | `inferable`                  | inference          | Delete or Backspace is React Flow's default, and the prototype used it. Check: no plausible alternative.                                                                                                                                                                |
| S15. Which schema versioning scheme, and what does import accept?              | `requires-stakeholder-input` | human              | `schemaVersion` is SemVer, starting at `0.0.0`. Import accepts all versions and upgrades the data to the latest. Every upgrade process is validated in CI.                                                                                                              |
| S16. Should a same-name import replace the map without asking?                 | `requires-stakeholder-input` | human              | No. The app prompts before every replace, because every new map is named "Untitled Project" and a silent replace could wipe work. This supersedes the no-prompt part of S5.                                                                                             |
| S17. Does CI run the e2e and axe checks?                                       | `requires-stakeholder-input` | human              | Yes. A second CI job runs the Playwright suite, including the axe scans.                                                                                                                                                                                                |
| I13. What happens to a newer or unknown schema version?                        | `inferable`                  | inference          | Reject it with both versions named. No upgrade path exists from a version the app does not know. Check: the alternative "try to load it anyway" is ruled out, because S15 requires data to be upgraded to the current version, which is impossible from an unknown one. |
| I14. Are prototype files with numeric `schemaVersion: 1` accepted?             | `inferable`                  | inference          | Reject them as "not a project file". The prototype is reference only and its files were never released. Check: the alternative "treat 1 as legacy" is plausible but low impact, because only local prototype exports exist.                                             |
| I15. How is "enforced during development" made real for schema changes?        | `inferable`                  | inference          | Released fixtures are immutable, every released version has an upgrade path, and an export-shape test catches unversioned changes (AC44–45). Check: the alternative "code review only" does not satisfy S15's "validated in our CI process".                            |
| I16. Does the repo need a CI workflow?                                         | `inferable`                  | inference          | Yes. The repo has none, and S15 requires CI validation. A minimal workflow runs `npm test`. Check: no plausible alternative that satisfies S15.                                                                                                                         |
| I17. What does each SemVer level mean for data?                                | `inferable`                  | inference          | Major is breaking, minor is additive, and patch is a fix, per SemVer. Each bump adds an upgrade function and a fixture. Check: no plausible alternative.                                                                                                                |
| Scope signal: component count                                                  | `inferable`                  | inference          | The spec has seven components that ship together as one shell. Slicing happens in `/plan`.                                                                                                                                                                              |
| Completeness: Step CRUD                                                        | `inferable`                  | inference          | Create and update belong to the editing spec (S1). Read is the cards (AC7–12). Delete follows AC17.                                                                                                                                                                     |
| Completeness: Connection CRUD                                                  | `inferable`                  | inference          | Create follows AC13–16. Read is the edges. Update is not applicable, because a connection has no mutable fields. Delete follows AC17.                                                                                                                                   |
| Completeness: Project CRUD                                                     | `inferable`                  | inference          | Create follows AC27. Read is the header (AC1–3). Update is import (AC33–34); rename belongs to the editing spec. Delete belongs to the projects spec (S4).                                                                                                              |
| Completeness: Project file                                                     | `inferable`                  | inference          | Create is Export (AC28–29). Read is Import (AC31–37, with upgrades per AC41–46). Update and delete are not applicable, because the file lives outside the app.                                                                                                          |
| Completeness: Metric                                                           | `inferable`                  | inference          | A read-only projection, so it has no create, update, or delete.                                                                                                                                                                                                         |
| Completeness: unsaved work on reload                                           | `inferable`                  | inference          | The user deferred persistence (S2), so a reload discards changes by design. No warning is required in this spec.                                                                                                                                                        |
| LOW_VALUE skip: hide the MiniMap for small maps                                | n/a                          | inference          | A cosmetic suggestion with no observable rule worth a test. It is not an acceptance criterion.                                                                                                                                                                          |

## Deferred specs

- **Step editing:** edit name, PT, LT, %C&A, queue, and batch; add steps; rename the project (S1).
- **Projects and persistence:**
  - Autosave to the browser (S2).
  - A header project switcher (S4).
  - New project (S10).
  - Delete project (S11).
  - Import into one of several saved projects (S12).
- **Keyboard connect path:** WCAG 2.1.1 for creating and removing connections (S3), to design together.
- **Release semantic versioning:** SemVer app versions enforced during development (scope split).

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion: shell (AC1–3), help (AC4–6), cards (AC7–12), connections (AC13–17), metrics (AC18–26), project (AC27), export (AC28–30), import (AC31–37), accessibility (AC38–40), schema versioning (AC41–46)
- [x] Architecture constrains without over-engineering: no backend, no storage, no new runtime dependencies, pure modules for logic
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts: deferred items are excluded from the intent, the architecture, and the acceptance criteria
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS**
