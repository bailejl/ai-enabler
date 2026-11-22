# ai-enabler

ai-enabler aims to be a value stream mapping tool. A value stream map shows every step from an idea,
through release, to users in production. The focus is automation from code to deployment. The goal
is to find waste, handoffs, and delays in the delivery pipeline, and to recommend fixes so teams
know where they stand. The intent is to improve the delivery environment so AI adoption succeeds.

## Status

Early scaffold. The UI is React with [React Flow](https://reactflow.dev) (`@xyflow/react`), served
by Vite. It shows a starter value stream (Idea to Production) on a canvas you can pan, zoom, and
drag nodes around on. None of the analysis goals above are built yet.

The live site is at <https://bailejl.github.io/ai-enabler/>. It deploys after CI passes on `main`.
Links use hash routes (`#/`, `#/projects/<id>`), not path-style URLs, so they survive a refresh on
GitHub Pages.

## Prerequisites

- Node.js `>=24.11.0` (set in `engines` in `package.json`). `.nvmrc` pins `24.11.0`, so `nvm use`
  picks a matching release.
- npm.

## Setup

```sh
npm install
npx playwright install chromium
```

`npm install` also runs `husky` (the `prepare` script) to set up the Git hooks.

## Commands

| Task                      | Command                 |
| ------------------------- | ----------------------- |
| Dev server (:3000)        | `npm run dev`           |
| Prototype server (:3001+) | `npm run dev:prototype` |
| Production build          | `npm run build`         |
| Preview build             | `npm run preview`       |
| Unit tests                | `npm test`              |
| Unit tests (watch)        | `npm run test:watch`    |
| Coverage                  | `npm run test:coverage` |
| E2E tests                 | `npm run test:e2e`      |
| Lint                      | `npm run lint`          |
| Lint (deep, ESLint)       | `npm run lint:deep`     |
| Lint fix                  | `npm run lint:fix`      |
| Format                    | `npm run format`        |
| Check formatting          | `npm run format:check`  |
| Mutation testing          | `npx stryker run`       |
| Run the MCP server        | `npm run mcp`           |
| Rebuild the plugin bundle | `npm run build:plugin`  |
| Check the plugin bundle   | `npm run check:plugin`  |

Mutation testing (changing code on purpose to check that tests catch it) runs on `src/**/*.{js,jsx}`,
`scripts/**/*.js` and `mcp/**/*.js`, excluding test files, `scripts/**/*-cli.js`, `mcp/server.js`,
`src/main.jsx`, and `src/App.jsx`. `App.jsx` is only wiring for React Flow; the e2e tests cover it.
`mcp/server.js` is a thin stdio shell over the tested tools. `plugin/server/` is a generated
bundle and is excluded.

## Project layout

- `index.html`, `src/main.jsx` - app entry point.
- `src/App.jsx` - the React Flow canvas.
- `src/flow/` - value stream data and logic, kept as plain functions so it can be unit tested.
- `src/shell/` - app shell code, including hash routes (`routes.js`) and the `useRoute` hook.
- Unit tests sit next to the code as `*.test.js` or `*.test.jsx`.
- `e2e/` - Playwright end-to-end tests. Playwright starts its own dev server, and a production
  preview under `/ai-enabler/` for the `pages` project. Each checkout gets its own ports, derived
  from its path: dev on 3100-3999, preview on the dev port + 1000. Set `PORT` to choose the dev
  port (an existing server on it is reused outside CI), and `PREVIEW_PORT` to choose the preview
  port.
- `mcp/` - the MCP server (stdio) that lets an AI assistant read and edit project files. It imports
  from `src/flow/` only.
- `plugin/` - the Claude Code plugin: skills, `.mcp.json`, and the generated, committed server bundle
  (`plugin/server/`) and schema copy (`plugin/schema/`).
- `public/` - files served as-is on the site: `llms.txt` and the JSON Schema under `schema/`.
- `.claude-plugin/` - the plugin marketplace manifest.
- `vite.config.js` - Vite dev server and build settings.
- `vite.mcp.config.js` - builds the MCP server into `plugin/server/` (`npm run build:plugin`).
- `vitest.config.js` - unit test and coverage settings.
- `playwright.config.js` - Playwright settings (Chromium only).
- `stryker.config.mjs` - mutation testing settings.
- `eslint.config.js` - deep lint rules.
- `prettier.config.js` - formatting rules.
- `scripts/` - Node tooling: push guards, the e2e port and Pages base-path helpers, and a GitHub
  Actions expression evaluator, with colocated `*.test.js`.
- `.husky/` - Git hooks.
- `.claude/` - Claude Code settings, project instructions, and agent files.

## Conventions

- Functional style: no classes, no `this`, prefer `const`, no parameter reassignment. ESLint
  enforces this.
- ES modules only: use `import` and `export`. Do not use `require`, `module.exports`, or
  `__dirname`.
- Prettier formats code and docs: 2-space indent, single quotes, no semicolons, trailing commas,
  100-character lines.
- oxlint is the fast, everyday linter. ESLint is the deeper check (`npm run lint:deep`).

More detail is in `.claude/CLAUDE.md`.

## Git hooks

The repo ships two Husky hooks.

- `.husky/pre-commit` refreshes the Repowise index if `repowise` is installed, and stages the
  regenerated `.claude/CLAUDE.md` and `.github/copilot-instructions.md` unless they had unstaged
  edits. It then runs `lint-staged`: oxlint and Prettier on JavaScript and JSX files, Prettier on JSON,
  Markdown, and YAML.
- `.husky/pre-push` runs the proto push guard, then `npm test` and `npm run test:e2e`. The tests are skipped when every pushed ref is a delete.

If Graphify is installed, it adds local `post-checkout`, `post-commit`, `post-merge`, and
`post-rewrite` hooks in `.husky/` that rebuild `graphify-out/`. They are gitignored, so they only
exist on machines where `graphify hook install` was run.

## Prototyping

Use the `/prototype` Claude Code skill (`.claude/skills/prototype`) to try a UI idea fast, before you
write a spec.

- `/prototype start <name>` creates the local branch `proto/<name>` from `main` and starts the
  prototype server. On `proto/*` branches only, Claude skips tests and review.
- `/prototype graduate` writes a handoff under `docs/prototypes/` and commits it on `feat/<name>`.
  If you approve, it pushes that branch and opens a GitHub issue for `/dev-team:specs`.
- `npm run dev:prototype` serves on port 3001, or the next free port if 3001 is taken. `npm run dev` stays on port 3000.

Prototype branches are meant to stay local. Two guards block pushes of them:

- `.husky/pre-push` runs `scripts/proto-push-guard-cli.js`, which calls `scripts/proto-push-guard.js`.
  It refuses to push any `proto/*` ref.
- A Claude Code `PreToolUse` hook runs `scripts/claude-push-guard-cli.js`, which calls
  `scripts/claude-push-guard.js`. It blocks `--no-verify` and `HUSKY=0` pushes and pushes of
  `proto/*` refs.

## AI tooling

You do not need any of this to build or test the project.

- The `aie` Claude Code plugin gives an assistant an MCP server and the `aie-guide` and `aie-review`
  skills for building and reviewing value stream maps. Install it with
  `/plugin marketplace add bailejl/ai-enabler`, then `/plugin install aie@ai-enabler`.
- For local development, register the server from a checkout with
  `claude mcp add aie-mcp -- npm run --silent mcp`. It reads and writes `./projects/` in the folder
  it starts in.
- [`public/llms.txt`](public/llms.txt) tells an assistant the file format, tools, and rules.
  [`AGENTS.md`](AGENTS.md) is the entry point for agents working in this repo.
- `.claude/agents/` holds agent files for Claude Code: `esm-enforcer.md` and
  `front-end-testing.md`.
- Repowise keeps a code index in `.repowise/`. The pre-commit hook refreshes it.
- CodeGraph keeps a code index in `.codegraph/`.
- Graphify keeps a knowledge graph in `graphify-out/`.
