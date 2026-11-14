---
name: prototype
description: Prototype a UI idea fast on a local proto/* branch, with no tests, plan, or review agents. Use when the user says "/prototype", "prototype this", or "spike a UI idea".
argument-hint: start <name> | graduate
---

# Prototype (ai-enabler)

Usage: /prototype start <name> | /prototype graduate

If the first word is not `start` or `graduate`, print the usage line above. Change nothing. A bare
`/prototype` is not unknown: on a `proto/*` branch it iterates (see Iterate); elsewhere it
refuses and points to `/prototype start <name>`.

## Rules

- Prototype branches are `proto/<name>`. They stay on this machine. Never push one.
- The `proto/` prefix is hardcoded in this skill, its references, `README.md`,
  `.claude/CLAUDE.md`, and the push guards. The prefix lives in `scripts/proto-push-guard.js`
  (`PROTO_PREFIX` and `isProtoRef`); `scripts/claude-push-guard.js` reuses `isProtoRef`. If you
  change it, change all of them.
- On a `proto/*` branch only, skip tests, plans, review agents, and `/pr`.
- The Husky commit hooks still run. Graduate's handoff-only commits set `SKIP_REPOWISE=1` to skip
  only the Repowise step (see `references/graduate.md`). Never use `--no-verify`. If a hook fails, fix the cause and
  commit again.
- On any other branch, do not skip the process. Say so and point to `/prototype start <name>`.

## Prototype server

`npm run dev:prototype` tries port 3001 and moves to the next free port if 3001 is taken. Never
assume 3001. Get the URL with these commands. Find matches the `--mode prototype` flag in the
`dev:prototype` script in `package.json`; if you change that script, change Find too.

- Find: run `pgrep -f 'vite --mode prototype'`. Keep a pid only if its cwd equals
  `git rev-parse --show-toplevel` (cwd from `lsof -a -p <pid> -d cwd -Fn`, strip the leading `n`)
  and it is listening (below). The `npm exec` parent also matches but does not listen; skip it.
  If more than one pid remains, use the one with the lowest port and tell the user the others are
  running.
- Port: `lsof -a -p <pid> -iTCP -sTCP:LISTEN -P -n -Fn`. The port is the text after the last `:`
  on the `n` line.
- Prototype URL: `http://localhost:<port>`.
- Start: run `npm run dev:prototype` in the background (`run_in_background`). Read its output for
  up to about 30 seconds until a `Local:   http://localhost:<port>/` line appears, then confirm
  with `curl -sf <url>`. If the line does not appear, or curl fails, show the server output and
  report the failure. Do not report a URL.
- Stop: `kill <pid>` for each pid that Find returns.

## start <name>

Run all three checks first, in this order. Change nothing until they all pass.

1. The name matches `^[a-z0-9]+(-[a-z0-9]+)*$`. If not, ask for a kebab-case name.
2. `git status --porcelain` is empty. If not, ask the user to commit or stash.
3. The Playwright MCP tools `mcp__playwright__browser_navigate` and
   `mcp__playwright__browser_take_screenshot` are available. If not, tell the user to install
   Playwright MCP.

Then:

1. If `proto/<name>` exists, ask whether to resume it.
   - Yes: `git switch proto/<name>`, then go to step 3.
   - No: ask for another name and start over at check 1.
2. Otherwise, run `git switch -c proto/<name> main`. Use local `main`. Do not fetch.
3. Find the prototype server. If one is running, report its URL. Otherwise start it and report
   the URL it prints.

## Iterate

Use this section on a `proto/*` branch for any UI request, including bare `/prototype`.

1. Edit the code directly.
2. Find the prototype server; if none is running, start it (see Prototype server). Check the
   change in the browser with the Playwright MCP tools: navigate to the prototype URL, take a
   screenshot into `.playwright-mcp/` (gitignored), and read
   `mcp__playwright__browser_console_messages`.
3. A step works when the page renders with no console errors. Ignore a 404 for `/favicon.ico`.
   Any other console error fails the step. Fix it before you commit.
4. Commit each working step. The subject is `<what>: <why>`. The body records any approach you
   tried and dropped, and why.

## graduate

Follow `references/graduate.md`.
