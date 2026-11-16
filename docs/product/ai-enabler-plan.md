# AI Enabler — Product Plan and Backlog

Nov 15, 2026 · @Joe

> **Status:** This doc holds the plan. Live status for each work item is in its GitHub issue, with one milestone per phase. The item sections below are a snapshot from Nov 15, 2026 and are not kept in sync with the issues.

## Summary

AI Enabler (AIE) shows teams how bad their value stream really is before they add AI, then shows where AI will help, where it will break things, and what to fix first. The goal is for AI to speed up the end-to-end stream, not one local step. AIE supports software value streams in depth and office value streams with a generic toolset. It runs as a static site on GitHub Pages, and all AI work happens in skills outside the app.

This doc is the complete plan. It merges the original feature list, the VSM research and the review feedback into 36 work items across four phases, each written as an issue.

**What makes AIE different**

1. **It maps value streams, not process flows.** Every box carries wait time, a queue and %C&A as ranges, with checks that warn when they're missing.
2. **It forecasts the next constraints, not just the current one.** A constraint ladder shows which box saturates next as AI raises volume, so teams can fix it first.
3. **It models how AI breaks a stream.** Queues grow, or quality quietly collapses as reviewers rubber-stamp. Both outcomes are simulated.
4. **It starts from data where data exists.** GitHub history drafts the pipeline and the VSM, and AIE then leads a short conversation about the gaps.
5. **It treats a separate recovery path as a defect.** Fixes should flow through the normal pipeline, so AIE shows the cost of any bypass.
6. **Every feature ships with its help page and skills,** kept current by a Definition of Done rule.

**Work item format.** Each item has an outcome as its title, a why, the original request where there was one, the scope, the skills it needs, open questions and labels. The labels are `ui` or `tooling`, plus a size: `size:prototype` (UI behavior still unclear), `spec` (clear but non-trivial) or `small`. IDs E1–E16 come from the original feature list, and N1–N20 are new.

## Guiding principles

These ten rules come from the research and the review. Every work item traces back to at least one of them.

1. **Map the work item, not the toolchain.** A box exists only where work is transformed, verified or decided, and it has one owner. Every box has a queue in front of it, automated boxes included.
2. **Declare the unit, and show where it changes.** In software the unit moves from idea to stories to changes to a release. Each segment names its unit, and split and join markers show the conversion. End-to-end lead time is counted in the customer's unit and ends when the last child is released.
3. **Queues, batches and approvals are where lead time lives.** In the worked example below, the 248 typical wait hours split into 136 from batches and meetings, 112 from handoff queues, and 0.3 from the automated commit stage.
4. **Knowledge work varies, so capture ranges.** Every PT, WT and %C&A has a low, typical and high value. The ranges drive the Monte Carlo forecast and show honest uncertainty.
5. **Find the current constraint, then forecast the next ones.** AI moves constraints quickly. AIE shows the order in which boxes saturate as volume rises, so teams can fix them before AI exposes them.
6. **Queues show where; anti-patterns explain why.** Queueing finds the delay. The MinimumCD anti-pattern catalog names the cause and the fix. Some problems hide from queues: rubber-stamped reviews make a queue shrink while defects escape.
7. **Use data where it exists; people always validate it.** When GitHub history exists, AIE drafts the pipeline and the VSM, then drives a short conversation about the gaps. When it doesn't, AIE runs a guided whiteboard session. %C&A and waits outside the tools always come from people.
8. **Outcome first, map second, plan last.** The transformation plan is the deliverable, not the drawing. DORA metrics are indicators, never targets.
9. **One path to production.** A separate recovery or hotfix path means the main pipeline is too slow or untrusted. AIE maps the bypass only to show its cost and drive it out.
10. **AI amplifies the system it lands in, so show the system honestly.** AIE's job is to show how far the current system is from getting real value from AI, in measurable terms, and what to fix first. Persuade with ranges and sources, never shame.

**Skills, not embedded AI.** The app stays deterministic: it draws, calculates, validates and simulates. Skills supply judgment, interviews and writing. A versioned project schema is the contract between them (E13).

## Worked example: the map AIE draws

This is the current-state map AIE would draw for an enterprise web team, using every visual component in the plan. Today's constraint is the weekly regression batch, and code review is the box that breaks first once AI coding scales.

See [`worked-example-vsm.html`](worked-example-vsm.html): current-state map, 10 boxes, all visual components.

Read it left to right along one row. The bands above the boxes mark each segment and its unit of work, and the split (1→8) and join (8→1) markers show where the unit changes. Queues sit in front of every box, automated ones included. Rework runs below the boxes as dashed arrows, and the red line shows the hotfix bypass. The ladder and summary strip at the bottom carry the totals that the next section explains.

**Reference layout for the canvas.** The [horizontal version of this map](worked-example-vsm.html) is how AIE's canvas should look: one row, left to right, with process boxes over data boxes (PT, WT, %C&A, batch, trigger), batch cadence and size on push arrows, rework and bypass below, the lead-time ladder under the boxes, and a legend. Its HTML and SVG source is `docs/product/worked-example-vsm.html`, so Claude Code can read the exact visual conventions from it.

## Worked example: the numbers AIE shows

The current state takes about 35 business days typical (P85: 55 days), and only 13% of items get through without rework. Under an AI coding rollout, code review saturates first, at 189% utilization. Fixing the system first cuts lead time to about 5 days and makes the AI gain real. All figures are illustrative: an enterprise web team of 12 developers, about 20 PRs a week, 8-hour business days. They were computed with the models proposed in E11, N18 and E15.

### Current-state data box (ranges are low / typical / high)

| #   | Box                   | Unit                        | Performer           | Owner        | PT (h)           | WT (h)        | %C&A              | Trigger / batch                         |
| --- | --------------------- | --------------------------- | ------------------- | ------------ | ---------------- | ------------- | ----------------- | --------------------------------------- |
| 1   | Intake and prioritize | Feature                     | Human               | Product      | 2 / 4 / 8        | 40 / 80 / 160 | 60 / 70 / 80%     | Monthly portfolio review                |
| 2   | Refine into stories   | Feature → 8 stories (split) | Human               | Team         | 4 / 8 / 16       | 16 / 40 / 80  | 60 / 75 / 85%     | On demand                               |
| 3   | Develop story         | Story                       | Human+AI            | Developer    | 4 / 8 / 16       | 8 / 16 / 40   | 70 / 80 / 90%     | Pull                                    |
| 4   | Code review           | Change (PR)                 | Human (handoff)     | Peer         | 0.5 / 1 / 2      | 4 / 16 / 32   | 80 / 85 / 95%     | Push, 20% rework to 3                   |
| 5   | Commit stage          | Change                      | Automated (grouped) | Pipeline     | 0.3 / 0.5 / 0.75 | 0.1 / 0.3 / 1 | 80 / 85 / 92%     | Every merge. Flaky tests                |
| 6   | Security triage       | Change                      | Human (handoff)     | AppSec       | 0.5 / 1 / 2      | 8 / 16 / 40   | 60 / 70 / 80%     | Push, 30% rework to 3                   |
| 7   | Regression testing    | Change                      | Human (handoff)     | QA team      | 4 / 8 / 12       | 8 / 20 / 40   | 70 / 75 / 85%     | Weekly batch, \~40 PRs. 25% rework to 3 |
| 8   | CAB approval          | Change                      | Gate                | Change board | 0.5              | 4 / 20 / 40   | 95% (2% rejected) | Weekly meeting                          |
| 9   | Production deploy     | Release batch               | Human + script      | Ops          | 2 / 3 / 4        | 8 / 16 / 40   | 85 / 90 / 95%     | Saturday window → **Deployed**          |
| 10  | Release (flag ramp)   | Feature (join 8 → 1)        | Business decision   | Product      | 0.5 / 1 / 2      | 8 / 24 / 80   | 95%               | Last story deployed → **Released**      |

A hotfix path from box 3 straight to box 9 skips boxes 6–8. 12% of changes use it, and AIE flags it as a bypass (N5).

### Summary metrics: current vs future state

| Metric                                | Current           | Future         | Change                 |
| ------------------------------------- | ----------------- | -------------- | ---------------------- |
| Lead time, idea to released (typical) | 283 h (35 days)   | 41 h (5 days)  | −86%                   |
| Lead time range (all low to all high) | 122–616 h         | —              | Shows the uncertainty  |
| Monte Carlo P50 / P85 / P95           | 350 / 438 / 503 h | 47 / 62 / 77 h | P85 −86%               |
| Change lead time, merge to deployed   | 85 h              | 1.6 h          | −98%                   |
| Activity ratio (ΣPT ÷ ΣLT)            | 12.4%             | 34.9%          | ×2.8                   |
| Rolled %C&A (low / typical / high)    | 5 / 13 / 33%      | 43 / 60 / 78%  | ×4.6 typical           |
| Bypass path use                       | 12% of changes    | 0%             | One path to production |

The Monte Carlo P85 is 438 h. A simpler method (±25% triangle on each box's lead time, summed) gives 296 h for the same map, understating P85 by about a third, because it ignores skewed waits, batch intervals and rework loops. The largest contributors to lead time are intake (85 h mean), refinement (55 h), regression testing (42 h), release (39 h) and security triage (35 h).

### Constraint ladder (N18)

Today's constraint is wait-driven: the monthly intake cycle and the weekly regression batch. Volume-driven saturation then comes in this order:

| Order | Box                 | Utilization today | Saturates (over 85%) at | Utilization under the AI preset |
| ----- | ------------------- | ----------------- | ----------------------- | ------------------------------- |
| 1     | Regression testing  | 62%               | 1.36× arrivals          | 161%                            |
| 2     | Security triage     | 56%               | 1.53×                   | 165%                            |
| 3     | Code review         | 50%               | 1.70×                   | **189% (saturates first)**      |
| 4     | Refine into stories | 40%               | 2.12×                   | 79%                             |

### AI forecast (E15, N19)

The preset is Faros 2025: PRs merged +98%, PR size +154%, review time +91%. Under it, code review jumps from third to first, and three human boxes run past 160% utilization. AIE shows two possible outcomes for each overloaded box:

- **Queues grow.** Review wait rises from 16 h today to about 91 h at just 85% utilization, and it's unbounded beyond 100%. Lead time gets worse, not better.
- **Quality collapses.** Reviewers rubber-stamp, so review wait looks fine, but escapes and change fail rate rise. This is the MinimumCD "Rubber-Stamping AI-Generated Code" anti-pattern, rated Critical.

AIE's recommendation: before scaling AI coding, retire the weekly regression batch, embed security in the pipeline, replace the CAB with policy checks, and make review a pairing or synchronous practice. In the future state, the human boxes left are intake, refinement and pairing, with the most-loaded at 79% under the same preset.

### Future-state data box (typical values)

| #   | Box                                                          | Performer         | PT (h) | WT (h) | %C&A |
| --- | ------------------------------------------------------------ | ----------------- | ------ | ------ | ---- |
| 1   | Intake and prioritize (weekly replenishment)                 | Human             | 2      | 8      | 85%  |
| 2   | Refine into stories of 2 days or less                        | Human             | 4      | 8      | 90%  |
| 3   | Develop story with pairing (review built in)                 | Human+AI          | 6      | 2      | 92%  |
| 4   | Commit stage (pre-commit + CI stage 1)                       | Automated         | 0.1    | 0.05   | 97%  |
| 5   | Acceptance stage (ephemeral env, contract, regression, DAST) | Automated         | 0.5    | 0.25   | 95%  |
| 6   | Policy check and change record                               | Automated gate    | 0.05   | 0      | 99%  |
| 7   | Progressive deploy with auto-rollback → **Deployed**         | Automated         | 0.5    | 0.1    | 97%  |
| 8   | Release by flag ramp → **Released**                          | Business decision | 1      | 8      | 97%  |

## Build sequence

Build in four phases, each ending in a test of whether the product works. Items stay large on purpose so each keeps its whole idea; break them down when they're picked up.

Each phase ships its own skills and help pages, so AI support arrives with the feature it serves. The AI stress test comes last because it depends on everything before it.

**Build order and dependencies (text version of the diagram).** Within each phase, build in the order listed. "Depends on" names the items that must exist first. N17 Help and the Definition of Done apply to every item.

| Order | Item                                          | Phase | Depends on                                  |
| ----- | --------------------------------------------- | ----- | ------------------------------------------- |
| 1     | E13 Project schema and AI bridge              | 1     | — (foundation)                              |
| 2     | N13 GitHub Pages hosting and routing          | 1     | —                                           |
| 3     | N14 GoatCounter usage tracking                | 1     | N13                                         |
| 4     | E1 Homepage                                   | 1     | N13, E13                                    |
| 5     | N17 Help section                              | 1     | E1; then every item adds its page           |
| 6     | E2 Project types and domain profile           | 1     | E13                                         |
| 7     | E3 Canvas and data box                        | 1     | E2, E13                                     |
| 8     | N16 Three-point ranges                        | 1     | E3                                          |
| 9     | E5 Undo/redo                                  | 1     | E3                                          |
| 10    | E6 Rework loops                               | 1     | E3                                          |
| 11    | E7 Current and future states                  | 1     | E3                                          |
| 12    | N4 Deployed and Released end markers          | 1     | E3                                          |
| 13    | N7 Batch and cadence model                    | 1     | E3                                          |
| 14    | N8 Metric definitions and confidence          | 1     | E3                                          |
| 15    | N15 Units of work, split and join             | 1     | E3                                          |
| 16    | N2 Outcome, charter and guided start          | 1     | E1, E3                                      |
| 17    | N1 Map-health checks                          | 1     | E3, N2, N4, N8, N15, Default thresholds     |
| 18    | E11 Monte Carlo v2                            | 1     | N16, N7, E6                                 |
| 19    | E4 Software box library                       | 2     | E2, E3                                      |
| 20    | N3 Two-sided %C&A                             | 2     | E4                                          |
| 21    | N6 Gate and control attributes                | 2     | E4                                          |
| 22    | N5 Bypass path cost                           | 2     | E6, N4                                      |
| 23    | E14 Scorecards and recommendations            | 2     | E4, N3, N6, N8, Default thresholds          |
| 24    | N20 Anti-pattern diagnosis                    | 2     | E14, N5                                     |
| 25    | N11 Kaizen bursts and plan                    | 2     | E7, E14                                     |
| 26    | E8 Improvement report                         | 2     | E7, N2, N11                                 |
| 27    | N12 Event-log import and reconciliation       | 3     | E13, N8                                     |
| 28    | E12 GitHub export (gh extension)              | 3     | E13, E4, N12                                |
| 29    | E9 Linked levels (VSM, process map, pipeline) | 3     | E3, E7                                      |
| 30    | E16 Pipeline to VSM                           | 3     | E12, E4, E9                                 |
| 31    | E10 Versions and trends                       | 3     | E7, N8; uses N12 when present               |
| 32    | N10 Cost of delay                             | 4     | E3                                          |
| 33    | N9 Work mix and failure demand                | 4     | E3, N12                                     |
| 34    | E15 AI stress test                            | 4     | E3, E11, N3, N20; real data from E12 or N12 |
| 35    | N18 Constraint ladder                         | 4     | E11, E15                                    |
| 36    | N19 AI impact landing view                    | 4     | E15, N18, N10                               |

**Phase gates (text):** Phase 1 ends when a team maps a real stream in one session with WT, a queue and %C&A on every box. Phase 2 ends when AIE names the same constraint and top three anti-patterns as an experienced facilitator on the worked example. Phase 3 ends when a derived map's lead time is within 1.5× of measured change lead time on a real repository. Phase 4 ends when the AI forecast matches the published presets in direction and rough size.

## Phase 1 · MVP: a map that is a value stream

18 items. Gate: a team maps a real stream in one session, with wait time, a queue and %C&A on every box.

### N13 · AIE is live on GitHub Pages, and deep links survive a refresh

- **Why:** GitHub Pages is the primary home. It can't serve SPA paths like `/projects/<id>` on a direct load or refresh.
- **Scope:** Deploy workflow from the main branch. Hash routes (`/#/`, `/#/projects/<id>`), which avoid the 404.html redirect trick. Base path set for `<user>.github.io/<repo>/`. Optional custom domain. A localhost dev mode with the same routes.
- **Skills:** none.
- **Open questions:** Custom domain now or later? Proposed default: later; launch on the github.io address.
- **Labels:** `tooling` `small`

### N14 · We know which features people use, without collecting their data

- **Why:** A cheap, privacy-safe signal of adoption, to guide the backlog.
- **Scope:** GoatCounter's free hosted plan (AIE is non-commercial). Set `no_onload`, and call `count()` on each `hashchange` with the project ID replaced by `:id` (for example `/projects/:id/canvas`). Count feature events such as `monte-carlo-run`, `github-import` and `version-saved`. Never send map contents, names or IDs. A short privacy note on the help page, plus a setting to opt out.
- **Skills:** none.
- **Open questions:** Which 10–15 events matter most? Proposed default: project created, map saved, version saved, Monte Carlo run, GitHub import, event import, scorecard viewed, AI stress test run, report exported, help page opened, skill install link clicked, file autosave enabled.
- **Labels:** `tooling` `small`

### E1 · Users can find, create, open and manage their projects from the homepage

- **Original request:** Homepage at the root with the AI Enabler title and a list of existing projects, sortable by name and date modified. Each project can be deleted or opened, at `/projects/<internal id>`. Create a new project here.
- **Why:** The entry point for every session.
- **Scope:** As requested, plus rename, duplicate and JSON import/export on each project card. Import/export is the bridge to skills (E13). Delete asks for confirmation.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `small`

### E2 · Users choose a software or office project, built on one shared data model

- **Original request:** Two project types, software and office-based, selected at creation. Software covers idea-to-production with its unique challenges. Office is generic.
- **Why:** The two domains share the core VSM method, and office streams now contain automated and AI steps. Two data models would double the work.
- **Scope:** One data model with a domain profile. The software profile adds DORA metrics, the software box library and GitHub bindings. The office profile adds takt/pitch, FTE capacity and systems-per-box. An office map can link to a software map when an improvement depends on an IT change, so that change's lead time shows in the office plan.
- **Skills:** none.
- **Open questions:** Can a project change type later? Proposed default: no; duplicate it as the other type instead.
- **Labels:** `ui` `spec`

### E3 · Users can build a map whose boxes carry the standard VSM data

- **Original request:** Refine canvas actions: create, edit, modify and delete items on the canvas. Add the basic general data for a process.
- **Why:** A box without wait time, queue and %C&A turns the map into a process flow.
- **Scope:** Canvas CRUD for boxes, edges, queues and markers. Box fields: Name (verb + noun), Description, Owner role, Team, Headcount, Performer type (human, automated, human+AI, agent, gate), PT, WT, %C&A (as ranges, N16), WIP and oldest item, batch size, trigger (continuous, scheduled with interval, on demand), unit of work (N15), data source and confidence (N8). E3 starts with single values; N16, N15 and N8 extend these fields. Lead time is computed as WT + PT, never typed. A soft warning past 15 boxes.
- **Skills:** aie-facilitate (optional, fills boxes through an interview).
- **Open questions:** Free-form canvas, ordered time ladder, or both? Proposed default: both views of the same data, canvas first, laid out like the horizontal worked example.
- **Labels:** `ui` `size:prototype`

### N16 · Users enter low, typical and high values instead of one number

- **Why:** Knowledge work isn't consistent like a factory. Ranges are more honest and feed the Monte Carlo forecast directly.
- **Scope:** Three-point entry for PT, WT and %C&A. Typical is required; low and high are optional and default from the project's variability setting (25%). The map shows "2–5 d". Summary metrics show typical, with the range beside it. Rolled %C&A gets a range too.
- **Skills:** none.
- **Open questions:** Should high mean the worst case or the P90? Proposed default: P90, a bad but realistic case.
- **Labels:** `ui` `spec`

### E5 · Users can undo and redo any change to a project

- **Original request:** Undo/redo for changes on a project.
- **Why:** Mapping is exploratory, so mistakes must be cheap.
- **Scope:** As requested, covering canvas, data and version actions. Keyboard shortcuts.
- **Skills:** none.
- **Open questions:** Should history persist across sessions? Proposed default: no, current session only.
- **Labels:** `ui` `small`

### E6 · Users can show rework loops with their rate and the time they add

- **Original request:** Show rework going back to earlier boxes with the % of the time it happens. The line runs from the top of the boxes, dashed, toward the box on the left.
- **Why:** Hidden rework is often the second-largest part of lead time after queues.
- **Scope:** Dashed rework line with % of items and hours added per loop. Drawn below the boxes (decided), following VSM convention, Martin & Osterling, with information flow above. Show expected effort as PT × (1 + rework rate). Warn when the rework % disagrees with the upstream box's %C&A.
- **Skills:** none.
- **Open questions:** none. Decided: rework lines run below the boxes.
- **Labels:** `ui` `small`

### E7 · Users can create current and future states and see their related diagrams

- **Original request:** Create as-is (current state) and to-be (future state) VSMs and related diagrams. VSM boxes appear as visual sections in the lower diagrams so relationships are clear.
- **Why:** The future state is where the improvement case is made.
- **Scope:** As requested. Copy the current state into one or more future states (near-term and target).
- **Skills:** aie-future-state (Phase 2).
- **Open questions:** none.
- **Labels:** `ui` `spec`

### N1 · Users are warned when their map is turning into a process flow

- **Why:** The main failure mode of VSM tools is a map with no queues, owners or quality data.
- **Scope:** Map-health checks that warn, never block: a box missing WT, queue, %C&A or owner; an automated box with no queue; more than 15 boxes; no outcome (N2); no end markers (N4); undeclared unit changes (N15). A map-health score beside the summary metrics.
- **Skills:** aie-guide explains each warning.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N2 · Every project starts with a clear outcome and scope

- **Why:** DORA, Flow Engineering and Martin all put the outcome before the map. Without one, improvements can't be judged.
- **Scope:** A guided start: target outcome ("from X to Y by when"), one-sentence scope with start and end triggers, sponsor, champion and work type. Then two paths: data-first (Phase 3 imports, then a gap conversation) or whiteboard (guided stages: scope, steps, time, quality, rework, review, future state). Outcome progress shows in E8 and E10.
- **Skills:** aie-facilitate.
- **Open questions:** How far does the app guide, and where does the skill take over? Proposed default: the app runs the stages; the skill does the interviewing and judgment.
- **Labels:** `ui` `size:prototype`

### N4 · Maps show when work is deployed and when it is released

- **Why:** DORA change lead time stops at deploy, but value reaches users at release. Feature flags separate the two.
- **Scope:** Two end markers per map, "Deployed" and "Released". Change lead time and deploy-to-release time shown separately. Office equivalent: "decision made" vs "customer has the outcome".
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N7 · Batches and fixed schedules show up as wait time automatically

- **Why:** Weekly CABs, nightly builds and release trains are the biggest hidden waits.
- **Scope:** A scheduled trigger with an interval adds about half the interval as average wait (Monte Carlo samples 0 to the interval). Batch size shows on a push arrow. The push arrow uses the striped VSM icon.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N8 · Every number says how it was measured and how much to trust it

- **Why:** Lead and cycle time definitions conflict across tools, and tool-reported flow efficiency runs several times higher than interview-based figures.
- **Scope:** A metric-definitions panel storing start and stop events per metric (lead time, cycle time, change lead time). Each figure is labelled estimate, interview, timestamps or tool status, with a confidence level. Definitions print on exports.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N15 · Maps show where the unit of work changes

- **Why:** In software the unit moves from idea to stories to changes to a release. Without explicit markers, lead times are counted in mixed units.
- **Scope:** Each box declares its unit. Split and join markers show the ratio ("1 feature → 8 stories"). End-to-end lead time is counted in the customer's unit and ends when the last child is released. The wait at a join is shown as a batch. A large split ratio with a long join wait is flagged as big-bang delivery.
- **Skills:** none.
- **Open questions:** Which units should be offered by default? Proposed default: idea, feature, story, change (PR), release, plus custom.
- **Labels:** `ui` `spec`

### E11 · Users see a realistic lead-time forecast, not a single number

- **Original request:** Lead-time Monte Carlo. Variability defaults to 25% and trials to 1,000. Shows P50 (typical), P85 (likely worst), P95 (rare worst) and the mean.
- **Why:** Summing boxes with symmetric noise understates the tail by about a third in the worked example.
- **Scope:** As requested, using a better model: PT and WT sampled separately from the three-point ranges, with right-skewed waits; scheduled steps sampled 0 to the interval; rework loops sampled from rates; parallel groups take the slowest branch; measured timestamps resampled when imported. The 25% default fills in missing ranges. Shows which boxes contribute most to P85.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `tooling` `spec`

### E13 · Any AI can read, build and validate an AIE project reliably

- **Original request:** An efficient way for AI to interact with AIE, running on GitHub Pages and/or localhost, supporting Claude, Claude Code and other AIs. Tools like Claude in Chrome are an option. AI must understand AIE so its users succeed.
- **Why:** Skills, not embedded AI, carry the judgment, so the app and skills need a shared, stable contract.
- **Scope:** (1) A versioned JSON schema for projects, maps, boxes, edges, versions, metrics and confidence. (2) Local-file autosave in Chrome and Edge (File System Access API), so Claude Code and Claude Desktop read and write the same file the app has open. Elsewhere, import/export plus "copy for AI". (3) Validation checks a skill can request at each stage gate (outcome set, data complete, future state consistent). (4) Claude in Chrome fallback, with stable `data-testid`s and a read-only `window.aie` API. (5) `AGENTS.md` and `llms.txt` describing the model and conventions. An optional local MCP server is deferred.
- **Skills:** aie-guide, aie-review.
- **Open questions:** How should the app pick up changes a skill writes to the open file? Proposed default: watch the file and show a "Reload changes" banner; never overwrite silently.
- **Labels:** `tooling` `spec`

### N17 · Users can learn the tool and VSM from built-in help

- **Why:** Most users won't know VSM conventions, and AIE's value depends on using them correctly.
- **Scope:** A help section with one page per feature, a VSM primer (value stream vs process flow, %C&A, units, ranges), a glossary, and the worked example as a sample project. Each feature page lists the skills it uses and how to install them (see Skills). Help is versioned with the app (see Keeping things current).
- **Skills:** aie-guide is the AI-facing help.
- **Open questions:** Help inside the SPA, or a separate docs site? Proposed default: inside the SPA, so it works offline and is versioned with the app.
- **Labels:** `ui` `spec`

## Phase 2 · Software depth and diagnosis

8 items. Gate: on the worked example, AIE names the same constraint and the same top three anti-patterns an experienced facilitator would.

### E4 · Software teams map with box types that know software

- **Original request:** Software-specific process boxes with extra data: types for common software activities plus a general activity box, each with general and type-specific data.
- **Why:** Type-specific data (runner queue, flake rate, PR size, deploy window) is what makes the merge-to-production segment a value stream.
- **Scope:** Two layers. A simple starter palette for new users: planning, development, code review, testing, QA, staging, deployment and a general activity. Monitoring is post-deploy verification plus a feedback loop, not a box. A detailed library grouped by Farley stage, using MinimumCD's pipeline reference architecture for stage contents and timing targets:

  | Segment            | Box types                                                                            | Type-specific data                                   | Target                    |
  | ------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------- |
  | Idea to ready      | Intake, discovery, refinement, design review                                         | Ready-definition met %, cost of delay                | —                         |
  | Build              | Development, **code review**                                                         | PR size, reviewers, review wait, AI-assisted share   | Stories of 2 days or less |
  | Commit stage       | Pre-commit + CI stage 1: lint, types, secrets, SAST, unit, build, SCA                | Runner queue, flake rate, false positives, escapes   | Under 5 min (warn at 10)  |
  | Acceptance stage   | CD stages 1–2 + acceptance: contract, schema, mutation, perf, DAST, acceptance tests | Env type (shared or ephemeral), env wait, suite time | Under 10, 15 and 20 min   |
  | Human verification | Security triage, manual QA, UAT, exploratory                                         | Batch interval, items per batch, team                | Off the critical path     |
  | Gate               | Peer approval, change record, CAB                                                    | See N6                                               | Automated where possible  |
  | Deploy             | Production deploy, canary, post-deploy verification                                  | Deploy window, rollback rate, automated (y/n)        | No window                 |
  | Release            | Flag ramp, value validation                                                          | Deploy-to-release time, kill-switch rate             | —                         |
  | Generic            | General activity                                                                     | General data only                                    | —                         |

  **Code review stays in the library because it's a handoff.** It defaults to a human box with a required queue, since it's the most common hidden queue and AI makes it worse. Future-state options are pairing or mobbing (merged into development), synchronous review, or a review agent behind a human gate.

- **Skills:** none.
- **Open questions:** none. Decided: AIE uses its own format and does not import other VSM tools' files.
- **Labels:** `ui` `spec`

### N3 · Automated stages are scored for both noise and missed defects

- **Why:** A gate is only as good as its verdicts. A real failure counts against the upstream box, which stops teams "improving" %C&A by weakening tests.
- **Scope:** For automated boxes and gates, record false failures (flakes, false positives) and escapes (defects found later). %C&A ≈ 1 − (false failures + wrong passes) ÷ runs. The same method scores AI classifiers and extractors in office maps.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N6 · Every approval shows what it costs and what risk it controls

- **Why:** Heavyweight external approvals correlate with low performance and no lower change fail rate. Regulated teams must keep the control objective while replacing the control.
- **Scope:** Gate fields: approver, evidence consumed, first-pass rate, rejection rate, meeting interval, risk controlled, control objective (PCI 6.5.4, SOX ITGC, FDA CSA). E14 uses them to suggest risk-tiered changes and policy-as-code.
- **Skills:** aie-diagnose.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N5 · Teams see the cost of any path that bypasses the pipeline

- **Why:** A separate hotfix or recovery path violates CD's single path to production. It exists because the main pipeline is too slow or untrusted.
- **Scope:** Map a bypass path with its usage %. AIE flags it, shows which gates it skips, and compares its lead time with the main path. The recommendation is always to speed up and harden the main pipeline until the bypass isn't needed. Recovery time is reported as DORA's failed deployment recovery time, measured through the main path.
- **Skills:** aie-diagnose.
- **Open questions:** none.
- **Labels:** `ui` `small`

### E14 · Teams get scorecards and recommendations aimed at their constraint

- **Original request:** Analysis and recommendations: CD readiness scorecard, flow readiness scorecard and recommendations.
- **Why:** A map only helps if it points at what to fix first.
- **Scope:** Name the constraint first, then recommend for that box only. CD readiness scorecard: the 9 MinimumCD core practices, inferred from map data with confirm and override, plus the 9-gate pre-feature baseline from the pipeline reference architecture. Flow readiness scorecard: work decomposition, testing fundamentals, WIP limits, small batches. DORA's five metrics as indicators, never targets. Gate checks from N6. Reconciliation gap from N12. Each recommendation links to a DORA capability and a MinimumCD anti-pattern (N20).
- **Skills:** aie-diagnose.
- **Open questions:** none. Decided: AIE uses its own thresholds, derived from research and MinimumCD (see Default thresholds).
- **Labels:** `ui` `spec`

### N20 · AIE explains why a box is slow, not just where

- **Why:** Queues show where time goes. The MinimumCD anti-pattern catalog names the cause and the fix, sorted by quality impact.
- **Scope:** A rules library mapping map signals to likely anti-patterns. Examples: a weekly regression batch → Manual Regression Testing Gates; a CAB box → Change Advisory Board Gates; shared staging with a long wait → Shared Test Environments; a hotfix bypass → single path violated; long splits → Monolithic Work Items; fast review with rising escapes → Rubber-Stamping AI-Generated Code. Each finding links to the catalog page.
- **Skills:** aie-diagnose.
- **Open questions:** Which 15–20 anti-patterns can be detected from map data? Proposed default: draft the list at the start of Phase 2, using the Default thresholds as triggers.
- **Labels:** `tooling` `spec`

### N11 · Every finding becomes a planned, owned improvement

- **Why:** The transformation plan, not the map, is the deliverable.
- **Scope:** Kaizen bursts on the map, tagged with waste type (Poppendieck), DORA capability and anti-pattern. Each becomes a plan item with owner, date, the box it changes and the expected metric change. The plan is sequenced by constraint and by the constraint ladder (N18) when present.
- **Skills:** aie-future-state.
- **Open questions:** Export plan items as GitHub issues? Proposed default: yes, through the aie-import-github skill.
- **Labels:** `ui` `spec`

### E8 · Teams can prove the value of an improvement with numbers and a report

- **Original request:** Show improvements from as-is to to-be, on screen and as a simple doc summarizing the improvement effort.
- **Why:** Improvement effort needs a measurable justification.
- **Scope:** A fixed comparison: lead time and range, P50/P85/P95, change lead time, activity ratio, %VA, rolled %C&A, batch size, deploy frequency, freed capacity (FTE hours) and outcome progress (N2). Future-state figures are labelled as targets. The app exports numbers and plan; a skill writes the report: one page for executives, the full plan for delivery leads.
- **Skills:** aie-report.
- **Open questions:** none. Decided: Markdown and PDF, not tied to any one tool.
- **Labels:** `ui` `spec`

## Phase 3 · Measure from real data

5 items. Gate: on a real repository, the derived map's lead time is within 1.5× of measured change lead time (see Default thresholds).

### E12 · Teams can pull their real pipeline and flow data from GitHub

- **Original request:** GitHub integration that automatically creates a pipeline diagram, using the gh CLI, API and MCP. Only official GitHub tools.
- **Why:** Workflow YAML shows structure only. The value stream data is in run history, PRs, deployments and environment approvals.
- **Scope:** A deterministic tool, not AI: a `gh` extension (`gh aie export`) that reads workflows, Actions runs and jobs (runner queue time, durations, re-run rate), PRs (time to first review, approval, merge; size), deployments and environment protection rules (required reviewers, wait timers), and releases (deploy batch size). It writes AIE project JSON in the shared event format (N12). An optional in-browser path for GitHub Pages users uses a read-only fine-grained token typed in by the user. The aie-import-github skill wraps the tool for judgment: grouping jobs into stages and asking about gaps.
- **Skills:** aie-import-github.
- **Open questions:** none. Decided: the gh extension plus a skill, with the in-browser token path as an option.
- **Labels:** `tooling` `spec`

### E16 · A pipeline diagram turns into a value stream, not a copy of the CI graph

- **Original request:** Create a VSM from a pipeline diagram (for example a GitHub workflow), from the start of the pipeline to its end, mapping to the software box types.
- **Why:** One box per CI job is exactly the process-flow trap.
- **Scope:** Collapse jobs into Farley stages when they share a trigger and owner, run in parallel and gate together (grouped PT = slowest branch). Split a job out when it has a different owner, trigger or batch, much lower %C&A, or is a likely constraint. Queues from runner wait and environment locks. Placeholder boxes for steps the pipeline can't see (review, manual QA, CAB, release), each opening the gap conversation.
- **Skills:** aie-import-github.
- **Open questions:** none.
- **Labels:** `tooling` `spec`

### E9 · Users can drill from a VSM box into its process map or pipeline and back

- **Original request:** Lower-level maps tied back to the VSM, to dive into detail and to derive VSMs from lower-level maps.
- **Why:** Detail is needed at the constraint, not everywhere.
- **Scope:** As requested. VSM boxes appear as labelled sections around their child steps in lower-level diagrams. Roll-up rules match E16, so drilling down and deriving give the same numbers. AIE suggests drilling down only into the constraint box, as DORA recommends.
- **Skills:** none.
- **Open questions:** none.
- **Labels:** `ui` `spec`

### N12 · Teams can calibrate any map with timestamps and see hidden queues

- **Why:** Not all data is in GitHub (Jira, Azure DevOps, ServiceNow, spreadsheets). Where a measured lead time far exceeds the map's total, there are queues the map doesn't show.
- **Scope:** Import CSV/JSON events (item, stage, entered, exited, re-entry) to derive PT, WT, queue and %C&A per box, with medians and P85s and a confidence label. A reconciliation view compares measured lead time with the map's total. Shared with E12.
- **Skills:** aie-calibrate.
- **Open questions:** none.
- **Labels:** `tooling` `spec`

### E10 · Teams can track their value stream over time against baseline and target

- **Original request:** Show VSMs and lower-level maps over time. Users state that an iteration is complete, which creates a version. Show the evolving as-is against the starting version, the current version and the current to-be.
- **Why:** Value stream management means proving progress, not mapping once.
- **Scope:** As requested. Each version freezes the map and its metric snapshot with data sources. Trends against baseline, current and to-be. Flags when the constraint moves to another box, which is the signal to re-map; otherwise a quarterly review prompt. Metrics stay at team level, never per person.
- **Skills:** aie-report.
- **Open questions:** none.
- **Labels:** `ui` `spec`

## Phase 4 · AI at the constraint

5 items. This is AIE's reason to exist, and it comes last because it needs the queueing model (E11), performer types (E3), escapes (N3), anti-patterns (N20) and real data (Phase 3). Gate: on the worked example, the forecast matches the published evidence presets in direction and rough size.

### E15 · Teams see where AI will break their value stream before they roll it out

- **Original request:** A simulation to stress-test a map. Boxes know whether work is done by humans, deterministic automation, AI-assisted humans or AI alone. The simulation scales batch and queue sizes by level of AI and automation, accounts for rework, and uses software-specific data and practices.
- **Why:** AI compresses coding, which is rarely the constraint, and pushes load into review, testing, integration and approvals.
- **Scope:** Model AI as a change in arrival rate and work size, not a faster box. Each performer level changes PT; human+AI and agent work also raise output and PR size. Downstream human boxes get more arrivals, and their wait grows non-linearly as utilization nears 100% (queueing behavior). Every overloaded box gets two simulated outcomes: the queue grows, or quality collapses (review PT falls, escapes and change fail rate rise: rubber-stamping). Evidence-based scenario presets, each with its source: DORA 2024 (−1.5% throughput, −7.2% stability per 25% adoption) and Faros 2025 (PRs +98%, review time +91%, PR size +154%). Agentic CD readiness check before allowing "agent" boxes: daily trunk integration, stories of 2 days or less, fast review, single path, deterministic pipeline; agents can't promote to production; a red pipeline allows only fixes.
- **Skills:** aie-ai-stress-test.
- **Open questions:** How should presets be weighted when sources disagree? Proposed default: never blend; show each source as its own scenario.
- **Labels:** `tooling` `spec`

### N18 · Teams see the next constraints before AI exposes them

- **Why:** AI moves constraints quickly. Fixing only today's constraint leaves teams reacting.
- **Scope:** A constraint ladder: today's constraint (wait-driven or volume-driven), then the order in which boxes pass 85% utilization or show quality collapse at 1.5×, 2× and 3× arrivals, and under each AI preset. Needs capacity per human box (headcount × hours available). Labelled as a forecast, re-run after each improvement.
- **Skills:** aie-ai-stress-test.
- **Open questions:** none. Decided: 85% utilization marks saturation, editable (see Default thresholds).
- **Labels:** `tooling` `spec`

### N19 · Every project opens on where AI will help, where it will break, and what to fix first

- **Why:** AIE exists to show how far a system is from getting real value from AI, in measurable terms. This view leads with that.
- **Scope:** The project landing view: today's activity ratio, rolled %C&A and bypass use; the AI forecast (which queues grow, how far quality drops); the value available if the system is fixed, in hours and in dollars where cost of delay is known (N10); the top three fixes from the constraint ladder. Honest framing with ranges and sources.
- **Skills:** aie-ai-stress-test, aie-report.
- **Open questions:** How should it look before a project has enough data? Proposed default: a checklist of what's missing, not empty charts.
- **Labels:** `ui` `size:prototype`

### N9 · Teams can see their mix of work and how much is failure demand

- **Why:** Rework, defects and clarification requests consume capacity AI could use. Seddon's failure demand and Kersten's flow distribution measure it.
- **Scope:** Classify demand as feature, defect, risk or debt, plus value vs failure demand. Feeds capacity in N18 and the office profile's demand study.
- **Skills:** aie-calibrate.
- **Open questions:** none.
- **Labels:** `ui` `small`

### N10 · Wait time can be shown in dollars

- **Why:** Executives respond to money. Cost of delay turns wait hours into dollars and supports weighted-shortest-job-first ordering.
- **Scope:** Optional cost of delay per work type or queue. Shown in E8, N19 and the plan (N11).
- **Skills:** aie-report.
- **Open questions:** none.
- **Labels:** `ui` `small`

## Skills: catalog and how users get them

Nine skills ship with the features that need them, and each work item names its skills. A feature isn't done until its skills are released (see Keeping things current).

| Skill              | What it does                                                                                                                | Used by           | Ships in |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- |
| aie-guide          | Teaches AIE conventions and VSM rules to any AI or new user. Explains map-health warnings                                   | E3, N1, N17, E13  | Phase 1  |
| aie-facilitate     | Runs the outcome, charter and guided mapping interview, and the gap conversation after an import                            | N2, E3            | Phase 1  |
| aie-review         | Requests the app's validation checks at each stage gate and comments on the results                                         | E13               | Phase 1  |
| aie-diagnose       | Names the constraint, scores readiness, checks gates and bypasses, and maps findings to anti-patterns and DORA capabilities | E14, N5, N6, N20  | Phase 2  |
| aie-future-state   | Proposes future-state maps and a transformation plan sequenced by the constraint ladder                                     | E7, N11           | Phase 2  |
| aie-report         | Writes improvement and progress reports for executives and delivery leads, labelling measured vs target numbers             | E8, E10, N10, N19 | Phase 2  |
| aie-import-github  | Runs `gh aie export`, groups jobs into stages and opens the gap conversation                                                | E12, E16          | Phase 3  |
| aie-calibrate      | Turns exported timestamps (Jira, Azure DevOps, CSV) into box data with confidence labels, and classifies demand             | N12, N9           | Phase 3  |
| aie-ai-stress-test | Picks evidence presets, runs the AI simulation and constraint ladder, and explains the results                              | E15, N18, N19     | Phase 4  |

**How users get them**

1. **One plugin.** All skills live in an `aie-skills` repo, published as a Claude Code plugin and as zip files for claude.ai. One install gets everything, and updates arrive together.
2. **In context.** Every feature that needs a skill shows a "Works with: aie-…" chip in the app. It links to that feature's help page, which gives the one-line install and an example prompt.
3. **Version-matched.** Each skill declares the schema version it supports. Skills read the project file's schema version first and warn when they are older than it.
4. **Thin skills, strict schema.** When a skill and the app disagree on a number, the app's calculation wins and the skill says so.

## Data model

One model serves both project types; the domain profile switches extras on. It combines the office VSM report's proposed entities with the software extensions. The JSON schema in E13 is its published form.

| Entity           | Key attributes                                                                                                                                                                                                                                      | Items                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Project          | id, name, type (software, office), domain profile, outcome (from, to, by when), scope sentence, sponsor, champion, schema version                                                                                                                   | E1, E2, N2           |
| ValueStream      | name, type (core, support), customer, start and end events, work type, demand rate, takt (office)                                                                                                                                                   | E2                   |
| MapVersion       | state (current, future n), level (VSM, process map, pipeline), parent box, complete flag, date, data-confidence score                                                                                                                               | E7, E9, E10          |
| Box              | name, description, owner role, team, headcount, performer (human, automated, human+AI, agent, gate), unit, PT/WT/%C&A {low, typical, high, source, confidence}, batch size, trigger {type, interval}, capacity hours, systems, type-specific fields | E3, E4, N8, N15, N16 |
| Queue            | box, WIP, oldest item age, snapshot time, source                                                                                                                                                                                                    | E3                   |
| Edge             | from, to, type (push, pull, FIFO, rework, bypass, split, join), rate %, split ratio, hours added                                                                                                                                                    | E6, N5, N15          |
| Gate             | approver, evidence, first-pass rate, rejection rate, interval, risk controlled, control objective                                                                                                                                                   | N6                   |
| AutomatedVerdict | runs, false failures, escapes                                                                                                                                                                                                                       | N3                   |
| EndMarker        | type (deployed, released)                                                                                                                                                                                                                           | N4                   |
| InformationFlow  | from, to, medium (manual, electronic, verbal), system, frequency                                                                                                                                                                                    | E3                   |
| KaizenBurst      | target boxes or edges, waste type, DORA capability, anti-pattern, expected deltas                                                                                                                                                                   | N11, N20             |
| PlanItem         | countermeasure, owner, dates, status, expected vs actual impact                                                                                                                                                                                     | N11                  |
| DemandClass      | type (value, failure), category (feature, defect, risk, debt), volume                                                                                                                                                                               | N9                   |
| CostOfDelay      | work type or queue, $ per week                                                                                                                                                                                                                      | N10                  |
| MetricDefinition | metric, start event, stop event                                                                                                                                                                                                                     | N8                   |
| MetricSnapshot   | lead time and range, PT, activity ratio, %VA, rolled %C&A, DORA five, flow metrics, period, sources                                                                                                                                                 | E8, E10              |
| EventLogBinding  | box ↔ stage mapping, item id definition, source (GitHub, CSV, Jira)                                                                                                                                                                                 | E12, N12             |
| Scenario         | AI preset, arrival multiplier, PR size factor, results (utilization, waits, quality outcome)                                                                                                                                                        | E15, N18             |

**Computation rules:** critical path through parallel groups (slowest branch); LT = WT + PT; rolled %C&A across all boxes, with ranges; activity ratio and %VA; expected effort with rework; fixed-interval wait ≈ half the interval; Little's Law cross-check, warning when interview LT and WIP ÷ throughput disagree by more than about 30%; FTE = PT × volume ÷ available hours; utilization = arrivals × PT ÷ capacity; queue wait scaling with utilization; current vs future delta table; sensitivity ("if %C&A at box 6 rises to 90%, rolled %C&A rises to X").

## Default thresholds

AIE ships its own default thresholds, derived from DORA, Farley, Martin & Osterling and beyond.minimumcd.org. Where no source sets a number, the value is AIE-derived and marked provisional. Every threshold is editable per project and stores its source, and the scorecards (E14), map-health checks (N1) and constraint ladder (N18) all read from this one table. They're indicators for spotting problems, never targets: MinimumCD lists DORA Metrics as Delivery Improvement Goals as an anti-pattern.

**Pipeline and integration**

| Measure                              | Good          | Warning         | Critical      | Basis                                                           |
| ------------------------------------ | ------------- | --------------- | ------------- | --------------------------------------------------------------- |
| Commit stage duration                | ≤ 5 min       | > 10 min        | > 30 min      | Farley: under 5, no more than 10. MinimumCD warns at 10         |
| Acceptance stage duration            | ≤ 20 min      | > 30 min        | > 60 min      | MinimumCD acceptance under 20. Farley: 30 target, 60 survivable |
| Merge to deployable (whole pipeline) | < 1 h         | > 1 day         | > 1 week      | DORA small batches: tested and deployed in under an hour        |
| Integration to trunk, per developer  | Several a day | Less than daily | Every 3+ days | MinimumCD: at least daily. Long-lived branches rated Critical   |
| Story / work-item cycle time         | ≤ 1 day       | > 2 days        | > 5 days      | DORA: hours to a couple of days. Agentic CD: 2 days or less     |
| False-failure (flaky) rate per stage | < 1% of runs  | > 2%            | > 5%          | AIE-derived, provisional                                        |
| Escapes from automated stages        | 0 known       | Any in 30 days  | Repeated      | AIE-derived (N3)                                                |

**Delivery outcomes (DORA 2024 clusters)**

| Measure                         | Good              | Warning        | Critical        | Basis                                                        |
| ------------------------------- | ----------------- | -------------- | --------------- | ------------------------------------------------------------ |
| Change lead time                | < 1 day           | > 1 week       | > 1 month       | Elite under a day; low one to six months                     |
| Deployment frequency            | On demand / daily | Weekly or less | Monthly or less | Elite multiple daily; low monthly to semiannual              |
| Change fail rate                | ≤ 5%              | > 15%          | > 30%           | Elite \~5%, high \~20%, low \~40%                            |
| Failed deployment recovery time | < 1 h             | > 1 day        | > 1 week        | Elite under an hour; low a week to a month                   |
| Deploy to release               | ≤ 1 week          | > 2 weeks      | > 1 month       | AIE-derived; long-lived release toggles are partly done work |

**Flow and quality on the map**

| Measure                           | Good           | Warning                        | Critical              | Basis                                                                           |
| --------------------------------- | -------------- | ------------------------------ | --------------------- | ------------------------------------------------------------------------------- |
| Activity ratio (flow efficiency)  | ≥ 25%          | < 10%                          | < 5%                  | Martin: typical current states 1–10%. "Good" at 25% is AIE-derived, provisional |
| Rolled %C&A                       | ≥ 60%          | < 30%                          | < 15%                 | Martin: typical current states 0–15%                                            |
| Box %C&A                          | ≥ 90%          | < 80%                          | < 60%                 | AIE-derived, provisional: below 60%, most items need rework                     |
| Rework rate per loop              | < 10%          | > 10%                          | > 25%                 | AIE-derived, provisional                                                        |
| Wait share of a box (WT ÷ LT)     | < 50%          | > 80%                          | > 95%                 | AIE-derived from typical activity ratios                                        |
| Human-box utilization             | ≤ 70%          | > 70%                          | > 85% (saturated)     | Queueing: wait grows \~2.3× at 70% and \~5.7× at 85% vs 50%                     |
| WIP vs people in a box            | ≤ 1 per person | > 1.5 per person               | > 2 per person        | AIE-derived from Little's Law, provisional                                      |
| Scheduled batch interval          | Continuous     | Weekly                         | Monthly or longer     | Fixed-interval wait ≈ half the interval                                         |
| Batch size                        | 1              | > 5                            | > 20                  | AIE-derived, provisional                                                        |
| Code review: wait to first review | ≤ 2 h          | > 1 day                        | > 2 days              | AIE-derived; vendor benchmarks put efficient pickup under a day                 |
| Bypass path use                   | 0%             | > 0%                           | > 10%                 | MinimumCD: single path to production                                            |
| Approval that rarely rejects      | —              | Rejects < 2% and waits > 1 day | Same, on most changes | DORA: CAB approval shows no lower change fail rate                              |
| Map vs measured lead time         | Within 1.5×    | > 1.5×                         | > 3×                  | AIE-derived, provisional: beyond 1.5×, the map is missing queues                |
| Boxes on one map                  | 5–15           | > 15                           | > 30                  | DORA and Martin: 5–15 blocks                                                    |

Provisional values get confirmed or changed once real projects produce data, as part of the quarterly MinimumCD review in Keeping things current.

## Keeping things current

Help pages and skills are how people and AI learn AIE, so they must change with the app. Two mechanisms keep them current: a Definition of Done for every change, and a schedule for content that depends on outside sources.

**Definition of Done (every feature or change)**

- [ ] Help page for the feature added or updated, including screenshots
- [ ] Skills that use the feature updated and released in `aie-skills`
- [ ] JSON schema version bumped if the data changed, with a migration for older project files
- [ ] `AGENTS.md` and `llms.txt` updated
- [ ] Changelog entry written
- [ ] Sample project (the worked example) still opens and its numbers still compute
- [ ] CI check passes: every skill declares a schema version the app supports

**Scheduled updates**

| What                                                                                       | Depends on                                    | When                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------- |
| AI evidence presets (E15)                                                                  | DORA annual report, Faros and similar studies | Yearly, when DORA publishes         |
| DORA metric definitions                                                                    | dora.dev                                      | Yearly                              |
| MinimumCD practices, thresholds, anti-pattern rules, pipeline stage targets (E4, E14, N20) | beyond.minimumcd.org                          | Quarterly                           |
| GitHub export tool (E12)                                                                   | GitHub REST API and `gh` releases             | Quarterly, plus on breaking changes |
| Regulated control mappings (N6)                                                            | PCI DSS, FDA CSA guidance                     | Yearly                              |
| Help screenshots and the sample project                                                    | The app's UI                                  | Every release                       |
| GoatCounter events list (N14)                                                              | New features                                  | Every release                       |

The schedule itself can be a recurring task that opens one review issue per row.

## How AIE uses MinimumCD

AIE is its own system. It doesn't import, depend on or mirror any other VSM tool, and its file format, box types, models and thresholds are its own. It draws on published research (DORA, Farley, Martin & Osterling, Flow Engineering) and on beyond.minimumcd.org as follows.

**How AIE uses MinimumCD**

| Source                                                                                                          | Used for                                                                                                                                 | Items        |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| [Anti-patterns catalog](https://beyond.minimumcd.org/docs/anti-patterns/)                                       | Diagnosis rules from map signals to causes and fixes, sorted by quality impact                                                           | N20, E14     |
| [Agentic CD](https://beyond.minimumcd.org/docs/agentic-cd/)                                                     | Readiness check before "agent" boxes; agents can't promote; red pipeline allows only fixes; AI's first value is showing where work waits | E15, N19     |
| [Pipeline reference architecture](https://beyond.minimumcd.org/docs/reference/pipeline-reference-architecture/) | Stage contents and timing targets; the 9-gate pre-feature baseline; off-critical-path verification                                       | E4, E14, E16 |

## Sources

**Inputs merged into this plan**

- AI Enabler project docs (held outside this repo): `research/vsm-software-delivery-field-guide.md`, `claude/vsm-software-vs-office-comparison.md` (Part B) and `claude/office-vsm-research-report.md` (data model)

**Research**

- [MinimumCD — Anti-patterns](https://beyond.minimumcd.org/docs/anti-patterns/)
- [MinimumCD — Agentic Continuous Delivery](https://beyond.minimumcd.org/docs/agentic-cd/)
- [MinimumCD — Pipeline reference architecture](https://beyond.minimumcd.org/docs/reference/pipeline-reference-architecture/)
- [DORA — Value Stream Management guide](https://dora.dev/guides/value-stream-management/)
- [DORA — Streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)
- [DORA — History of DORA metrics](https://dora.dev/insights/dora-metrics-history/)
- [DORA — 2025 State of AI-assisted Software Development](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)
- [DORA — 2025 AI Capabilities Model](https://services.google.com/fh/files/misc/2025_dora_ai_capabilities_model.pdf)
- [Dave Farley — Deployment pipeline](https://www.davefarley.net/?p=208)
- [Value Stream Mapping (Martin & Osterling) summary](https://danlebrero.com/2021/03/10/value-stream-mapping-summary/)
- [Flow Engineering summary](https://danlebrero.com/2024/05/01/flow-enginnering-book-summary/)
- [DORA — Working in small batches](https://dora.dev/capabilities/working-in-small-batches/)
- [Octopus — The 2024 DevOps performance clusters](https://octopus.com/blog/2024-devops-performance-clusters)
- [Coralogix — DORA metrics tiers](https://coralogix.com/guides/dora-metrics/)

**Tools**

- [GoatCounter — single-page app setup](https://goatcounter.com/help/spa)
- [GoatCounter — JavaScript API](https://goatcounter.com/help/js)
