<!-- spec-version: 14.2.0 -->

# Spec: D1 Diagnostics core and gate

Source: row 4 of the MVP build order v2 (`plans/mvp-order.md`, branch `docs/mvp-order-v2`), and the "Diagnostics for AI agents" follow-up in `plans/ai-contract.md`. No GitHub issue. Requirement IDs refer to the Logging for AI Agents spec (MSG, CAT, GTE, PRD, SEC). Stakeholder decisions from 2026-11-22 are marked **Q**.

## Intent Description

When the app hits a problem today, the user may see a message, but nothing machine-readable is left behind, and a render crash shows a blank page. An AI agent that debugs the app (later, through Chrome DevTools MCP in D3) has no stable signal to read. This change makes the browser app write one coded JSON record to the console for every diagnostic it raises, in dev and production builds. Each record carries the catalog code, the severity, the app version, a session id and the platform. Records are built through an allow-list, so no map or project content reaches the console. Records are rate-limited per code, so a flood of one problem cannot drown the others.

A React error boundary catches render crashes. It writes a coded record and shows a fallback screen instead of a blank page. Uncaught errors and unhandled promise rejections are also coded.

A test gate makes the contract hold: unit and e2e tests fail when anything writes an uncoded error or warning, or when a coded record appears that the test did not expect. The app version comes from `package.json`, and `CHANGELOG.md` starts with this release.

## Architecture Specification

**Scope**

- In: the browser app (`src/`), the Vitest and Playwright gates, `package.json` version, `CHANGELOG.md`, new `APP_` catalog codes.
- Out: the MCP server's stderr log (`mcp/log.js`) and its problem results; the "Copy diagnostics" JSONL export, record buffer UI and DevTools MCP help (D3); repair guides (D2); generated docs pages (D3); usage counting (N14); the footer that shows the version (N17); OpenTelemetry export; CI checks for added suppressions (GTE-06, later item).

**Components**

- `src/flow/diagnostics/record.js` (pure): `toRecord(problem, context)` builds a record from a problem and a context (`version`, `session`, `platform`, `build`, `time`). It copies only allow-listed keys. It is the only place that builds a record.
- `src/flow/diagnostics/rateLimit.js` (pure): a per-code limiter as a plain value. `admit(state, code, now)` returns `{ state, emit, suppressed }`. No timers.
- `src/shell/diagnostics.js` (thin sink): holds the session context and limiter state, and writes admitted records to the console. It exposes `report(problem)` and `reportError(code, error)`. It is the only module in `src/` that calls `console.error`, `console.warn` or `console.info`.
- `src/shell/ErrorBoundary.jsx`: React 19 has no function-component error boundary, so this is the one allowed class component (**Q**). The lint exception for classes and `this` is scoped to this one file in the ESLint and oxlint configs. It reports `APP_RENDER_FAILED` and renders the fallback.
- `src/main.jsx`: wraps `<App />` in the boundary, and adds `error` and `unhandledrejection` listeners that report `APP_UNCAUGHT_ERROR` and `APP_UNHANDLED_REJECTION`.
- Call site: the import flow reports each problem of a rejected import. `problem()` stays pure and does not log; callers report.
- Version: Vite `define` injects `__APP_VERSION__` from `package.json` at build and test time. The client bundle does not import `package.json`.
- Gates: a Vitest setup file (`vitest.config.js` `setupFiles`) and a shared Playwright fixture (`e2e/fixtures.js`, which every spec imports in place of `@playwright/test`). Each provides a per-test `expectDiagnostics([...codes])`.

**Record shape** (one JSON string per console call, single line)

`{ "source": "aie", "code", "severity", "version", "session", "platform", "build", "time", "field"?, "suppressed"?, "error"? }`

- `source` is always `"aie"`, so the gate and D3 can tell records from other console output.
- `session` is a random id made at page load (`crypto.randomUUID()`), kept in memory only.
- `platform` is `"browser"`. `build` is `"dev"` or `"prod"` (Vite mode). No user agent.
- `time` is an ISO 8601 timestamp.
- `field` is included only when its value is in a fixed set of known field names (the `field` values the code sets today, such as `project.name` or `pt`).
- `suppressed` is the count of records of the same code the limiter dropped since the last emitted one.
- `error` is present only for `APP_` codes: `{ name }` in production; `{ name, message, stack }` in dev (**Q**).
- Never included: `message`, `fix`, `untrusted`, `params`, `stepId`, `edgeId`, file names, project names, or any other value from the map. The agent reads the message and fix from the catalog by code.
- Console method by severity: `error` → `console.error`, `warning` → `console.warn`, `hint` → `console.info`.

**Constraints**

- Functional style and ES modules, per `CLAUDE.md`. The error boundary is the one exception to "no classes" (**Q**), with its lint exception scoped to `src/shell/ErrorBoundary.jsx` only.
- The diagnostics modules in `src/flow/diagnostics/` stay pure and import nothing from `src/shell/` or React.
- A diagnostic is written only through `report`/`reportError`, which take a catalog code (CAT-02). An unknown code throws, as `problem()` does.
- Expected codes are allowed per test only. There is no global allow-list or suppression (GTE-02).
- Gate failures print each offending record or console line with its code, severity, and the catalog fix line (GTE-05).
- The rate-limit window is wall-clock time, not working time. The working-time minutes rule applies to map durations only.
- New codes use the `APP_` prefix, `owner: "app"`, `status: "active"`, and `since` set to the current schema version (`0.1.0`). Each gets a docs anchor; D2 adds the guides.

**Dependencies**

- E13 PR1/PR2 catalog and `problem()` (merged).
- Merge before N17 (footer version), N14 (its code is a D1 record) and D3 (buffer and copy).

## Acceptance Criteria

1. **Coded record per diagnostic.** When an import is rejected, the console gets one record per reported problem, each a single-line JSON string that parses to an object with `source: "aie"` and the problem's catalog `code` and `severity`. Pass: an e2e test imports a non-JSON file and finds a `FILE_NOT_JSON` record via `console.error`.
2. **Context fields.** Every record has `version` equal to `package.json` `version`, a `session` that is the same for all records in one page load and differs after reload, `platform: "browser"`, `build` of `dev` or `prod`, and an ISO `time`. Pass: unit test on `toRecord`; e2e test checks `version` and `session` stability across two records and a change after reload.
3. **Same in dev and production.** A production build (`vite build` + `vite preview`) writes the same codes and fields as dev, except the dev-only `error.message` and `error.stack`. Pass: the existing `pages` Playwright project (or a preview run) finds the `FILE_NOT_JSON` record.
4. **Allow-list redaction.** A record contains only the keys listed in the record shape. Given a problem whose `untrusted`, `params`, `message`, `stepId` and `edgeId` hold a marker string, the record contains no occurrence of the marker. A `field` value outside the known set is dropped. Pass: unit tests on `toRecord`; an e2e test imports a file with a step named with a marker string and finds no record containing it.
5. **Per-code rate limit.** Per code, at most 5 records are emitted in any 60-second window; further occurrences are dropped and counted. The next emitted record of that code carries `suppressed: n`. Limits for one code do not affect another code. Pass: unit tests on `admit` with injected times, covering the 5th and 6th occurrence, the window rollover, the `suppressed` count, and two codes in parallel.
6. **Error boundary.** A render error anywhere under `<App />` writes one `APP_RENDER_FAILED` record (severity `error`) and shows a fallback with a heading, a one-line explanation, the code, and a "Reload" button that reloads the page. The fallback has no map content, meets the a11y suite (axe), and moves focus to its heading. Pass: e2e test that forces a render error (dev-only test hook, absent from production builds) and checks the record, the fallback, and axe.
7. **Uncaught errors and rejections.** An uncaught error writes `APP_UNCAUGHT_ERROR`; an unhandled promise rejection writes `APP_UNHANDLED_REJECTION`. In production the record's `error` holds only `name`. Pass: unit tests on the record builder for both `build` values; e2e test triggers each through the same dev-only hook.
8. **Unknown codes fail.** `report` and `reportError` throw on a code not in the catalog. Pass: unit test.
9. **Unit gate.** In Vitest, a test fails when it writes to `console.error` or `console.warn` with anything that is not an `aie` record, or writes an `aie` record whose code the test did not pass to `expectDiagnostics`. A test that declares an expected code that it never emits also fails. The failure names the code, severity and catalog fix line. Pass: gate self-tests that run a fixture test file in a child Vitest run and check it fails with that output.
10. **E2E gate.** In Playwright, a test fails on any `pageerror`, any console `error` or `warning` message that is not an `aie` record, and any `aie` record whose code the test did not expect; unexpected-never-emitted expectations fail too. Every e2e spec uses the shared fixture. Pass: a gate self-test spec, plus a unit test in `scripts/` that fails when any `e2e/*.spec.js` imports `test` straight from `@playwright/test`.
11. **No global suppression.** Neither gate reads a project-wide list of allowed codes or console patterns. Pass: covered by AC9 and AC10 having only the per-test API; code review checks it.
12. **Gates run in CI.** `npm test` and `npm run test:e2e`, already run on every PR by `ci.yml`, include the gates. Pass: the gate self-tests run in those commands.
13. **Severities and new catalog codes.** Catalog severities are `error`, `warning` or `hint` (MSG-02, **Q**); the catalog test rejects any other value. `APP_RENDER_FAILED`, `APP_UNCAUGHT_ERROR` and `APP_UNHANDLED_REJECTION` exist in `catalog.json` with every catalog field, severity `error`, and a docs anchor. Pass: catalog tests, updated for the three severities.
14. **App version.** `package.json` `version` is set to the agreed first version `0.1.0` (**Q**), and the client reads it only through `__APP_VERSION__`. Pass: unit test that `__APP_VERSION__` equals `package.json` `version`; the built bundle does not contain the `devDependencies` key.
15. **Changelog.** `CHANGELOG.md` exists in Keep a Changelog format, with an `Unreleased` section and a section for the current version listing what has shipped (Pages deploy, the AI contract with the MCP server, and diagnostics). Pass: a `scripts/` unit test fails when `CHANGELOG.md` has no `## [<package.json version>]` heading.
16. **Only the sink writes to the console.** No file in `src/` other than `src/shell/diagnostics.js` calls `console.*`. Pass: a lint rule (`no-console` with that one file excepted) in oxlint or ESLint.
17. **One class exception.** The no-classes and no-`this` lint rules stay on for every file except `src/shell/ErrorBoundary.jsx`. Pass: `npm run lint` and `npm run lint:deep` pass, and the configs name only that file in the exception.

## Glossary

| Term          | Definition                                                                                  | Status       | Source                                    |
| ------------- | ------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------- |
| Diagnostic    | A problem built from a catalog code through `problem()`                                     | `verified`   | `plans/ai-contract.md`, approved E13 spec |
| Record        | One single-line JSON console entry for one diagnostic, built through the allow-list         | `unverified` | This spec                                 |
| Allow-list    | The fixed set of record keys and `field` values that may reach the console                  | `unverified` | SEC-01; this spec                         |
| Uncoded error | Any console error or warning, page error or unhandled rejection that is not an `aie` record | `unverified` | GTE-01; this spec                         |
| Expected code | A code one test declares through `expectDiagnostics`                                        | `unverified` | GTE-02; this spec                         |
| App version   | `package.json` `version`, separate from the save-file schema version                        | `verified`   | MVP order v2 decision 7                   |

## Ambiguity Log

| Decision                                                                                                           | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allowed severities. The catalog test forces `error`; MSG-02 allows error, warning, hint; the N14 card says `debug` | `requires-stakeholder-input` | human       | Accepted 2026-11-22: catalog allows `error`, `warning`, `hint`. N14's `USAGE_SEND_FAILED` becomes `hint`, not `debug`. D1's own codes are `error`.                                                                        |
| Dev-only error detail                                                                                              | `requires-stakeholder-input` | human       | Accepted 2026-11-22: dev records add `error.message` and `error.stack`; production keeps `error.name` only.                                                                                                               |
| Rate-limit numbers                                                                                                 | `requires-stakeholder-input` | human       | Accepted 2026-11-22: 5 records per code per 60 seconds; dropped ones counted into `suppressed` on the next record; no timer flush.                                                                                        |
| Which events log in this item                                                                                      | `requires-stakeholder-input` | human       | Accepted 2026-11-22: rejected-import problems, render crashes, uncaught errors and unhandled rejections only. Commands log once R4 routes the UI through them.                                                            |
| Error-boundary fallback                                                                                            | `requires-stakeholder-input` | human       | Accepted 2026-11-22: heading, one line, the code, and "Reload". No export button.                                                                                                                                         |
| First app version                                                                                                  | `requires-stakeholder-input` | human       | Accepted 2026-11-22: `0.1.0`.                                                                                                                                                                                             |
| Fail on an expected code that never appears                                                                        | `requires-stakeholder-input` | human       | Accepted 2026-11-22: yes, the test fails.                                                                                                                                                                                 |
| MCP server records                                                                                                 | `requires-stakeholder-input` | human       | Accepted 2026-11-22: out of D1; no MCP records.                                                                                                                                                                           |
| Message in the record                                                                                              | `inferable`                  | inference   | Messages can hold step names (shortened titles). The code identifies the catalog message and fix, so the record leaves them out. Fits the user-text rule: user text only in `untrusted`, which never reaches the console. |
| `stepId` / `edgeId` in the record                                                                                  | `inferable`                  | inference   | Ids come from the imported file, so they are map content. Left out under the privacy rule.                                                                                                                                |
| `field` in the record                                                                                              | `inferable`                  | inference   | Today the code sets `field`, but a command argument name can come from a caller. A fixed set keeps it safe.                                                                                                               |
| Version source                                                                                                     | `inferable`                  | inference   | Vite `define` is the standard way; importing `package.json` would ship the whole file.                                                                                                                                    |
| Session id                                                                                                         | `inferable`                  | inference   | PRD-02 asks for one; a per-load random id in memory adds no tracking.                                                                                                                                                     |
| Platform value                                                                                                     | `inferable`                  | inference   | `browser` plus `build` meets PRD-02 without a fingerprintable user agent.                                                                                                                                                 |
| Error boundary as a class                                                                                          | `requires-stakeholder-input` | human       | Accepted 2026-11-22: one small class component, the only exception to the no-classes rule, with its lint exception scoped to that one file.                                                                               |
| Dev-only crash hook for e2e                                                                                        | `inferable`                  | inference   | The only way to force a render error in a real browser; gated by `import.meta.env.DEV` so production does not ship it.                                                                                                    |
| Rate-limit window units                                                                                            | `inferable`                  | inference   | Working-time minutes apply to map durations, not to runtime clocks.                                                                                                                                                       |
| Repair guides for new codes                                                                                        | `inferable`                  | inference   | D2 (row 7) adds a guide per code and its test; D1 adds codes with docs anchors.                                                                                                                                           |
| Showing the version in the UI                                                                                      | `inferable`                  | inference   | The N17 card owns the footer version. D1 only exposes `__APP_VERSION__`.                                                                                                                                                  |
| Expensive dev-only checks (PRD-03)                                                                                 | `inferable`                  | inference   | D1 adds no expensive checks, so there is nothing to split yet.                                                                                                                                                            |
| CRUD sweep: records                                                                                                | `inferable`                  | inference   | Create only (append to console). No read, update or delete in D1; D3 adds read (copy).                                                                                                                                    |
| CRUD sweep: catalog codes                                                                                          | `inferable`                  | inference   | Create three codes. Codes are never deleted or reused (CAT-03).                                                                                                                                                           |
| CRUD sweep: changelog                                                                                              | `inferable`                  | inference   | Create now; later items add entries under `Unreleased` (product plan DoD).                                                                                                                                                |
| Auth, authorization, audit                                                                                         | `inferable`                  | inference   | Static site, no accounts. Not applicable.                                                                                                                                                                                 |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human
