<!-- spec-version: 14.2.0 -->

# Spec: D2 Repair guides

Source: row 7 of the MVP build order v2 (`plans/mvp-order.md`), its rule "A change that adds a failure mode adds its catalog code, repair guide and docs. After D2, a test fails on any catalog code with no guide", and the "Diagnostics for AI agents" follow-up in `plans/ai-contract.md` (GDE: per-code repair guides). No GitHub issue and no dependency card (row 7 predates the cards). Prototype declined: no UI change. Stakeholder decisions are marked **Q** once answered.

## Intent Description

Each problem the app or the MCP server reports carries a catalog code and a one-line `fix`. One line is often not enough for an AI agent to repair the project safely: it does not say which tool to call, what to check first, or when to stop and ask the user. This change adds one repair guide per catalog code, as a separate Markdown file, so an agent using the `aie-review` or `aie-guide` skill can look up the code it got and follow a short, specific repair.

`aie-review` uses a guide to explain each problem and propose its repair without changing the project. `aie-guide` uses a guide to repair a problem before its next change. Guides live in their own files, one per code, so later edits to a skill and new guides do not touch the same file. A test fails when any catalog code has no guide, so every new failure mode ships with its guide.

## Architecture Specification

Components:

- `src/flow/diagnostics/guides/<CODE>.md` (**Q** location): one guide per catalog code, named by the code, such as `CONN_LOOP.md`. This is the one source. D3 reads the same files later for its generated help pages.
- Build: `build:plugin` (`vite.mcp.config.js`) copies the guides to `plugin/guides/`, in the same way it copies the JSON Schema. It empties the folder first, so a removed guide does not linger. `scripts/plugin-bundle-files.js` adds `plugin/guides` to the bundle folders, so `check:plugin` fails when the committed copy is stale.
- Skills: `plugin/skills/aie-review/SKILL.md` and `plugin/skills/aie-guide/SKILL.md` each gain one short section that says where the guides are (`guides/<CODE>.md` in the plugin folder, two levels above the skill's own folder) and when to read one. The skill text does not list codes or repeat guide content.
- Tests: a colocated `src/flow/diagnostics/guides.test.js` checks coverage and shape (see Acceptance Criteria). `mcp/plugin-manifest.test.js` checks the new skill sections.
- Plugin version: `plugin/.claude-plugin/plugin.json` `version` goes from `0.1.0` to `0.2.0` (**Q**), so installed plugins pick up the new skills and guides.

Guide format (plain Markdown, no front matter):

- First line: `# <CODE>: <catalog title>`.
- `## What it means`: what is wrong and the common causes, in a few lines.
- `## Repair with the tools`: numbered steps using only `aie-mcp` tools, ending with the call that checks the repair (the rejected call again, or `list_problems`). For a code that no tool can repair (for example `FILE_NOT_JSON`, or an `APP_` code), the section says so and says what to tell the user.
- `## Ask the user first`: the cases where the agent must not choose for the user, such as which of two duplicate connections to drop, which connection to remove to break a loop, or whether to discard unsaved changes. Says "None." when there are none.

Constraints:

- Guides never tell an agent to read or edit a project file directly. Every repair goes through the MCP tools, and a file that cannot be opened is the user's to fix.
- Guides name only tools, arguments, gates and fields that `public/llms.txt` documents. llms.txt stays the one source for those; a guide links to it rather than repeating field rules.
- Guides add no new data-not-instructions exceptions: they treat step names, ids and file names as data.
- No catalog, MCP server, tool result or app change. The catalog's one-line `fix` stays as it is; the guide adds to it.
- Follows `.claude/CLAUDE.md`: Prettier formats the Markdown; tests in Vitest; `scripts/` does not import from `src/`.
- Serial-merge rule: this changes `plugin/`, so the bundle is rebuilt and committed, and the PR merges alone.

Dependencies:

- E13 PR1–PR3 (merged): catalog, `problem()`, plugin, skills, llms.txt.
- D1 (row 4, in review on `feat/diagnostics-core`): adds `APP_RENDER_FAILED`, `APP_UNCAUGHT_ERROR`, `APP_UNHANDLED_REJECTION`, and the `warning` and `hint` severities. D2 must cover the three `APP_` codes (**Q** timing).

## Acceptance Criteria

1. **Every code has a guide.** For each key in `catalog.json`, `src/flow/diagnostics/guides/<CODE>.md` exists. Pass: a unit test that fails and names each catalog code with no guide.
2. **No orphan guides.** Every `.md` file in the guides folder is named after a catalog code. Pass: a unit test that fails and names each orphan file.
3. **Guide shape.** Each guide starts with `# <CODE>: <title>`, where the title equals the catalog entry's `title`, and has the three sections `What it means`, `Repair with the tools` and `Ask the user first`, in that order, each with text under it. Pass: a unit test per guide.
4. **Only real tools.** Every backticked name in a guide that looks like a tool (lowercase words joined by `_`, such as `add_step`) is an `aie-mcp` tool name from the server's tool list. Pass: a unit test that reads the tool names from the MCP server, not from a copied list.
5. **No direct file access.** No guide tells the agent to read, open with a file tool, or edit a project file directly. Pass: a unit test rejects guides that mention the Read tool, the Edit tool, or editing the JSON by hand as an agent step.
6. **Plugin carries the guides.** After `npm run build:plugin`, `plugin/guides/` holds exactly the source guides, byte for byte, and `npm run check:plugin` fails when a guide changes without a rebuild. Pass: bundle-files unit test includes `plugin/guides`; `check:plugin` passes on the committed tree.
7. **aie-review uses guides.** `aie-review` says to read the guide for each distinct code in the problems it reports, and to use it to explain the problem and propose the repair, still without changing the project. Its tool allow-list still names only `open_project`, `get_project` and `list_problems`; reading a guide file is allowed and is not an MCP call. Pass: plugin-manifest test.
8. **aie-guide uses guides.** `aie-guide`'s work loop says to read the guide for a problem's code before repairing it, and to ask the user when the guide's "Ask the user first" section applies. Pass: plugin-manifest test.
9. **Skills find the guides.** In a fresh Claude Code session with the plugin installed, `aie-review` on a project with a loop reads `guides/CONN_LOOP.md` from the plugin folder and reports its repair. Pass: manual check with `claude -p`, recorded in the PR description (not automated).
10. **Plugin version.** `plugin.json` `version` is `0.2.0`. Pass: plugin-manifest test still checks the semver shape; the value is reviewed in the PR.

## Glossary

| Term         | Definition                                                                                                                                 | Status       | Source                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------- |
| Repair guide | A Markdown file, one per catalog code, that tells an AI agent how to repair that problem with the `aie-mcp` tools and when to ask the user | `unverified` | this spec; GDE in `plans/ai-contract.md` |
| Catalog code | A key in `src/flow/diagnostics/catalog.json`, such as `CONN_LOOP`                                                                          | `verified`   | E13 PR1 spec, merged                     |
| Orphan guide | A guide file whose name is not a catalog code                                                                                              | `unverified` | this spec                                |

## Ambiguity Log

| Decision                                                                                                                                          | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the guide source lives: `src/flow/diagnostics/guides/` copied into `plugin/guides/` by the build, or written straight into `plugin/guides/` | `requires-stakeholder-input` | human       | Pending. Recommended: `src/flow/diagnostics/guides/`, next to the catalog, because D3's app build reads them and the app should not import from `plugin/`.                                                                                                                                                   |
| How skills reach the guides: read the files from the plugin folder, or a new MCP tool such as `get_guide`                                         | `requires-stakeholder-input` | human       | Pending. Recommended: read the files. An MCP tool means a new tool, llms.txt entry and parity work for text that never changes at run time. Cost: the files reach Claude Code users only; other agents get them through D3's help pages.                                                                     |
| The three `APP_` codes from D1: wait for D1 to merge and rebase, or write their guides now                                                        | `requires-stakeholder-input` | human       | Pending. Recommended: build on `main` now and add the three `APP_` guides after D1 merges, before the PR; the coverage test forces it. Writing them now fails the orphan test until D1 lands.                                                                                                                |
| Bump the plugin version                                                                                                                           | `requires-stakeholder-input` | human       | Pending. Recommended: `0.1.0` → `0.2.0`, since both skills change. Without a bump an installed plugin may keep the old skills.                                                                                                                                                                               |
| aie-review's "never call any other tool" rule and reading a guide file                                                                            | `inferable`                  | inference   | The rule exists to keep the review read-only. Reading a plugin guide is read-only and not an MCP call, so the rule is reworded to "never call any other aie-mcp tool" with guides named as allowed. The existing test bans the phrase "Read tool", so the skill says "read the guide" without naming a tool. |
| How many guides to read in a review                                                                                                               | `inferable`                  | inference   | One read per distinct code among the shown problems (at most 20). Reading per problem repeats work.                                                                                                                                                                                                          |
| Guide format: front matter or plain Markdown                                                                                                      | `inferable`                  | inference   | Plain Markdown with fixed headings. The title and severity already live in the catalog, so front matter would duplicate them; the test pins the heading to the catalog title.                                                                                                                                |
| Guide sections                                                                                                                                    | `inferable`                  | inference   | Meaning, tool repair, ask-the-user. These are what the one-line `fix` lacks; a "fix in the file" section is left out because skills never edit save files.                                                                                                                                                   |
| Does llms.txt change                                                                                                                              | `inferable`                  | inference   | No. llms.txt describes the file and tools for any agent; publishing guides on the site is D3's generated help pages.                                                                                                                                                                                         |
| Guides for codes no tool can repair (FILE_ parse codes, APP_ codes)                                                                               | `inferable`                  | inference   | Every code still gets a guide (row 7 says every code). Its tool section says no tool repairs it and what to tell the user.                                                                                                                                                                                   |
| Severity-specific content (warning, hint)                                                                                                         | `inferable`                  | inference   | Every current code is `error`. A future `hint` guide can say no action is needed; the shape test does not depend on severity.                                                                                                                                                                                |
| CRUD sweep: guides                                                                                                                                | `inferable`                  | inference   | Create: one per code now. Update: edit the file. Delete: never, because codes are never deleted or reused (CAT-03); a deprecated code keeps its guide. Read: skills, and D3 later.                                                                                                                           |
| CRUD sweep: auth, authorization, audit                                                                                                            | `inferable`                  | inference   | Not applicable: static files in a local plugin. No secrets, no user data.                                                                                                                                                                                                                                    |
| Error handling: guide file missing at run time                                                                                                    | `inferable`                  | inference   | The skill falls back to the problem's one-line `fix` and tells the user the guide was not found. The build and coverage test make this rare.                                                                                                                                                                 |
| Prompt injection through guides                                                                                                                   | `inferable`                  | inference   | Guides are repo-authored, not user data. They still restate that step names and ids are data, matching the skills' rule.                                                                                                                                                                                     |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [ ] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human (4 items wait for answers)
