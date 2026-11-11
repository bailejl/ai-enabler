# ai-enabler

ai-enabler aims to be a value stream mapping tool. A value stream map shows every step from an idea,
through release, to users in production. The focus is automation from code to deployment. The goal
is to find waste, handoffs, and delays in the delivery pipeline, and to recommend fixes so teams
know where they stand. The intent is to improve the delivery environment so AI adoption succeeds.

## Status

Early scaffold. The UI is React with [React Flow](https://reactflow.dev) (`@xyflow/react`), served
by Vite. It shows a starter value stream (Idea to Production) on a canvas you can pan, zoom, and
drag nodes around on. None of the analysis goals above are built yet.

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

| Task                | Command                 |
| ------------------- | ----------------------- |
| Dev server (:3000)  | `npm run dev`           |
| Production build    | `npm run build`         |
| Preview build       | `npm run preview`       |
| Unit tests          | `npm test`              |
| Unit tests (watch)  | `npm run test:watch`    |
| Coverage            | `npm run test:coverage` |
| E2E tests           | `npm run test:e2e`      |
| Lint                | `npm run lint`          |
| Lint (deep, ESLint) | `npm run lint:deep`     |
| Lint fix            | `npm run lint:fix`      |
| Format              | `npm run format`        |
| Check formatting    | `npm run format:check`  |
| Mutation testing    | `npx stryker run`       |

Mutation testing (changing code on purpose to check that tests catch it) runs on `src/**/*.{js,jsx}`,
excluding test files, `src/main.jsx`, and `src/App.jsx`. `App.jsx` is only wiring for React Flow;
the e2e tests cover it.

## Project layout

- `index.html`, `src/main.jsx` - app entry point.
- `src/App.jsx` - the React Flow canvas.
- `src/flow/` - value stream data and logic, kept as plain functions so it can be unit tested.
- Unit tests sit next to the code as `*.test.js` or `*.test.jsx`.
- `e2e/` - Playwright end-to-end tests. Playwright starts the dev server on
  `http://localhost:3000` itself.
- `vite.config.js` - Vite dev server and build settings.
- `vitest.config.js` - unit test and coverage settings.
- `playwright.config.js` - Playwright settings (Chromium only).
- `stryker.config.mjs` - mutation testing settings.
- `eslint.config.js` - deep lint rules.
- `prettier.config.js` - formatting rules.
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
- `.husky/pre-push` runs `npm test` and `npm run test:e2e`.

If Graphify is installed, it adds local `post-checkout`, `post-commit`, `post-merge`, and
`post-rewrite` hooks in `.husky/` that rebuild `graphify-out/`. They are gitignored, so they only
exist on machines where `graphify hook install` was run.

## AI tooling (optional)

You do not need any of this to build or test the project.

- `.claude/agents/` holds agent files for Claude Code: `esm-enforcer.md` and
  `front-end-testing.md`.
- Repowise keeps a code index in `.repowise/`. The pre-commit hook refreshes it.
- CodeGraph keeps a code index in `.codegraph/`.
- Graphify keeps a knowledge graph in `graphify-out/`.
