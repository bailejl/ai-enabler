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
  `.claude/CLAUDE.md`, and both push guards (`PROTO_PREFIX` in `scripts/proto-push-guard.js`).
  If you change it, change all of them.
- On a `proto/*` branch only, skip tests, plans, review agents, and `/pr`.
- The Husky commit hooks still run. Never use `--no-verify`. If a hook fails, fix the cause and
  commit again.
- On any other branch, do not skip the process. Say so and point to `/prototype start <name>`.

## start <name>

Run all four checks first, in this order. Change nothing until they all pass.

1. The name matches `^[a-z0-9]+(-[a-z0-9]+)*$`. If not, ask for a kebab-case name.
2. `git status --porcelain` is empty. If not, ask the user to commit or stash.
3. The Playwright MCP tools `mcp__playwright__browser_navigate` and
   `mcp__playwright__browser_take_screenshot` are available. If not, tell the user to install
   Playwright MCP.
4. Port 3001 is free: `lsof -ti tcp:3001 -sTCP:LISTEN` prints nothing. If it prints a pid, show
   `ps -o command= -p <pid>` and offer to stop that process.
   - Yes: `kill <pid>`, run check 4 again, then continue.
   - No: stop. Do not report the prototype as running.

Then:

1. If `proto/<name>` exists, ask whether to resume it.
   - Yes: `git switch proto/<name>`, then go to step 3 to restart the server.
   - No: ask for another name and start over at check 1.
2. Otherwise, run `git switch -c proto/<name> main`. Use local `main`. Do not fetch.
3. Run `npm run dev:prototype` in the background (`run_in_background`).
4. Poll `curl -sf http://localhost:3001` for up to about 30 seconds.
5. When it answers, report `http://localhost:3001`. If it never does, show the server output and
   report the failure. Do not report a URL.

## Iterate

Use this section on a `proto/*` branch for any UI request, including bare `/prototype`.

1. Edit the code directly.
2. Check it in the browser with the Playwright MCP tools: navigate to `http://localhost:3001`,
   take a screenshot, and read `mcp__playwright__browser_console_messages`.
3. A step works when the page renders with no console errors. Fix errors before you commit.
4. Commit each working step. The subject is `<what>: <why>`. The body records any approach you
   tried and dropped, and why.

## graduate

Follow `references/graduate.md`.
