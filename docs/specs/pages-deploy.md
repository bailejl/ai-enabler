<!-- spec-version: dev-team 14.2.0 -->

# Spec: Pages deploy, hash routes, base path

**Format:** dev-team specs 14.2.0 (validate mode)
**Source:** [Issue #25, N13 · AIE is live on GitHub Pages, and deep links survive a refresh](https://github.com/bailejl/ai-enabler/issues/25), the same text as `docs/product/ai-enabler-plan.md` §N13.
**Status:** Approved. The user answered S1–S4 on 2026-11-21.

Citation keys:

- `[I §<field>]`: a field of issue #25 (Why, Scope, Open questions).
- `[P §<section>]`: a section of the product plan.
- `[S<n>]`: answer n in this spec session's Ambiguity Log.
- `[Inferred]`: an inference, logged in the Ambiguity Log.

## Intent Description

GitHub Pages is the primary home of AIE [I §Why]. This change publishes the app to `https://bailejl.github.io/ai-enabler/` on every change to `main`, and makes the app's URLs work there.

GitHub Pages serves static files only, so a path such as `/projects/<id>` returns 404 on a direct load or a refresh [I §Why]. The app uses hash routes (`/#/` and `/#/projects/<id>`) instead, so every URL loads `index.html` and no 404.html redirect is needed [I §Scope]. The same routes work on the localhost dev server [I §Scope].

This change adds the route layer and the deploy. It does not add project storage, a project list, or a custom domain. E1 (#27) gives `/#/projects/<id>` its real content, and N14 (#26) counts route changes [P §N14].

## Architecture Specification

**Components**

- **Deploy workflow** (`.github/workflows/`): builds with `npm run build` and publishes `dist/` with the official GitHub Pages actions. It runs for `main` only [I §Scope], and only after CI passes on that commit [S2]. It reuses `.github/actions/setup`.
- **Base path** (`vite.config.js`): the production build resolves every asset under `/ai-enabler/` [I §Scope]. The dev server keeps working at `http://localhost:<PORT>/` [Inferred I3]. The mechanism (an absolute `/ai-enabler/` or a relative `./` base) is a plan decision; either meets AC3.
- **Route module** (`src/flow/routes.js` or similar): a pure function that maps a hash string to a route value (`home`, `project` with an id, or unknown) and back. It has unit tests and no React import [Inferred I4, CLAUDE.md conventions].
- **Route hook** (`src/shell/`): reads `window.location.hash`, listens for `hashchange`, and gives the current route to `App.jsx`. It is the single place that touches `window.location` [Inferred I4].

**Constraints**

- No new runtime dependency for routing [Inferred I4].
- No server-side or 404.html redirect [I §Scope].
- Existing e2e tests keep running against `npm run dev` at `/` [Inferred I3].
- Deploy permissions are scoped to the deploy job: `pages: write`, `id-token: write`. The CI workflow stays `contents: read` [Inferred I6].
- No change to the save-file format, so the AC23 parity rule in `plans/mvp-order.md` does not apply. D1 has not shipped, so the catalog-code rule does not apply yet [Inferred I8].

**Dependencies**

- One-time repository setting, done by the user by hand: Settings → Pages → Source = GitHub Actions [S4]. The build does not call `gh api` to enable it. Pages is not enabled on the repository today (the Pages API returns 404).

## Acceptance Criteria

### Deploy

- **AC1:** A push to `main` whose CI run passes publishes that commit's build to `https://bailejl.github.io/ai-enabler/`. [I §Scope "Deploy workflow from the main branch", S2]
- **AC2:** A push to `main` whose CI run fails does not deploy, and the site keeps the last good build. A pull request never deploys. [S2]
- **AC3:** The deployed page loads with no 404 for any script, stylesheet, or other asset, and renders the app shell. [I §Scope "Base path set for `<user>.github.io/<repo>/`"]
- **AC4:** The deploy can also be started by hand from the Actions tab (`workflow_dispatch`) on `main`. [Inferred I5]

### Routes

- **AC5:** `/#/` renders the app shell. [I §Scope]
- **AC6:** A direct load or a refresh of `/ai-enabler/#/projects/<id>` returns the app, not a 404, and renders the app shell. The URL keeps `#/projects/<id>`. [I §Why, §Scope]
- **AC7:** Until E1 ships, `/#/` and `/#/projects/<id>` render the same starter shell as today (ui-shell AC27). The `<id>` is not checked against any store. [S3]
- **AC8:** A URL with no hash, an empty hash, or a hash that matches no route is replaced with `#/` (history `replace`, not `push`), and renders the shell. [S3]
- **AC9:** Changing the hash in the address bar, or with browser back and forward, updates the route without a full page reload. [Inferred I7]
- **AC10:** The route module parses `#/`, `#/projects/<id>`, a trailing slash, and an unknown path to the right route value, and builds the hash string for each route. Unit tested. [Inferred I4]

### Local and test

- **AC11:** `npm run dev` serves the same hash routes at `http://localhost:<PORT>/`, with AC5–AC9 behavior. [I §Scope "A localhost dev mode with the same routes"]
- **AC12:** An automated e2e check builds the app with the production base path, serves it under `/ai-enabler/`, and passes AC3 and AC6 (direct load of `/ai-enabler/#/projects/abc`). It runs in CI. [Inferred I9]
- **AC13:** The README states the live URL. [Inferred I10]

### Out of scope

- Custom domain. [S1, I §Open questions]
- Project storage, a project list, and loading a project by id (E1 #27).
- Usage counting on `hashchange` (N14 #26).

## Glossary

| Term       | Definition                                                                                     | Status       | Source                 |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------ | ---------------------- |
| Hash route | An app URL whose route is after `#`, for example `/#/projects/<id>`. The server sees only `/`. | `unverified` | I §Scope               |
| Base path  | The URL prefix the site is served under: `/ai-enabler/` on GitHub Pages, `/` on localhost.     | `unverified` | I §Scope               |
| Deep link  | A URL that opens a specific route on a direct load or a refresh.                               | `unverified` | Issue title            |
| App shell  | The current single-map UI from `docs/specs/ui-shell.md`.                                       | `verified`   | docs/specs/ui-shell.md |

## Ambiguity Log

| Decision                                          | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1. Custom domain now or later?                   | `requires-stakeholder-input` | human       | Later; launch on github.io. Out of scope here.                                                                                                                                                                                  |
| S2. When does the deploy run?                     | `requires-stakeholder-input` | human       | Only after green CI on a push to `main`, plus `workflow_dispatch`.                                                                                                                                                              |
| S3. What do routes render before E1 adds storage? | `requires-stakeholder-input` | human       | Both routes show the starter shell; the id stays in the URL unused; an unknown or empty hash becomes `#/`.                                                                                                                      |
| S4. Who turns on Pages (Source = GitHub Actions)? | `requires-stakeholder-input` | human       | The user, by hand in Settings → Pages. The build must not call `gh api` to enable it; the plan lists it as a manual prerequisite.                                                                                               |
| I3. Does the dev server move to `/ai-enabler/`?   | `inferable`                  | inference   | No. The source asks for "the same routes", and routes are hashes, so the path prefix does not change them. Existing e2e runs at `/`. Check: alternative "dev at `/ai-enabler/`" adds churn to every e2e URL for no stated gain. |
| I4. Router library or hand-rolled?                | `inferable`                  | inference   | Hand-rolled pure module plus one hook. Two routes, CLAUDE.md asks for pure logic under `src/flow/`, and no dependency is needed. Check: React Router is plausible but E1 can adopt it if its routes grow.                       |
| I5. Manual deploy trigger?                        | `inferable`                  | inference   | Yes, `workflow_dispatch`, standard for Pages and needed to redeploy after a settings change. Low risk.                                                                                                                          |
| I6. Workflow permissions                          | `inferable`                  | inference   | GitHub's Pages actions require `pages: write` and `id-token: write`; scope them to the deploy job and keep CI read-only, matching the existing `permissions: contents: read`.                                                   |
| I7. Back/forward and hash edits                   | `inferable`                  | inference   | Hash routing implies `hashchange` handling; N14 depends on `hashchange` [P §N14].                                                                                                                                               |
| I8. mvp-order rules                               | `inferable`                  | inference   | No save-file field and no new failure mode, and D1 is not built. Neither rule applies.                                                                                                                                          |
| I9. How is the base path verified before deploy?  | `inferable`                  | inference   | An e2e check against a production build served under `/ai-enabler/`, so a wrong base fails CI instead of the live site. Check: alternative "verify by hand after deploy" leaves AC3 untested.                                   |
| I10. Live URL in README                           | `inferable`                  | inference   | The site is the primary home [I §Why], so the README points to it. Low risk.                                                                                                                                                    |
| Completeness: Route CRUD                          | `inferable`                  | inference   | Routes are read-only views of the URL. Create/update/delete of projects belongs to E1.                                                                                                                                          |
| Completeness: auth, authz, audit                  | `inferable`                  | inference   | Public static site, no backend, no accounts. Deploy auth is GitHub's OIDC token (I6).                                                                                                                                           |
| Completeness: error handling                      | `inferable`                  | inference   | Unknown routes: AC8. Failed CI: AC2. Failed deploy job: the workflow run shows red and the last good build stays live (GitHub Pages behavior).                                                                                  |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion: deploy (AC1–4), base path (AC3, AC12), routes (AC5–10), local mode (AC11), docs (AC13)
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human
