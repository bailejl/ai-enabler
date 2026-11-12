# Graduate

Turn a prototype into a handoff on a real feature branch. The prototype code is reference only.

## Steps

Before each step, print `Graduate step n of 9: <title>`.

1. Preflight
2. Advisory agents
3. Interview
4. Screenshots
5. Branch and handoff
6. Stop the server
7. Preview
8. Push and issue
9. Wrap up

## Entry

`<name>` is the part of the branch name after `proto/` or `feat/`.

- On `proto/<name>`: start at step 1.
- On `feat/<name>`: run `git diff --name-only main..HEAD`. If it is not empty and lists only
  `docs/prototypes/<name>.md` and `docs/prototypes/<name>/*.png`, the handoff is already
  committed. Skip to step 7.
- Anywhere else, including `main`: stop and say to run on a `proto/*` branch.

## 1. Preflight

Run these checks in order. Change nothing until all pass. Stop at the first failure.

1. `git status --porcelain` is empty. If not, ask the user to commit or discard first.
2. `git diff main...HEAD` is not empty. If it is, say there is nothing to graduate.
3. `feat/<name>` is absent. If it exists and `git diff --name-only main..feat/<name>` lists only
   handoff files, ask whether to reuse it (switch to it and skip to step 7). If it holds anything
   else, ask for another name for `feat/<name>` and the handoff. The prototype branch keeps its
   name.
4. `curl -sf http://localhost:3001` answers. If not, run `npm run dev:prototype` in the
   background and poll `curl -sf` for up to about 30 seconds. If it never answers, stop and
   show the server output.

## 2. Advisory agents

Ask one question: "Run ui-ux-designer, a11y-review, and exploratory-testing against the
prototype? Default is yes. Reply with agent names to drop, or 'no' for none."

Run each accepted one as `dev-team:<agent>` and give it `http://localhost:3001` and
`git diff main...HEAD`. Run them in parallel. Use a subagent for an agent and the Skill tool for
a skill.

Record a declined agent as "Not run". Record an agent that errors, times out, or returns nothing as
"<agent>: Did not complete". No outcome blocks graduate.

## 3. Interview

Draft every handoff section from `git diff main...HEAD` and the bodies from `git log main..HEAD`.
Show the draft. Ask only about gaps the code and commits cannot answer, such as why a choice was
made. Treat a "skip" or "unsure" answer as unanswered and add it to Open questions.

## 4. Screenshots

Use the Playwright MCP tools to capture each distinct state at `http://localhost:3001`. Save the
PNG files to the session scratchpad, not the repo. Give each a short kebab-case name and a
one-line description.

## 5. Branch and handoff

1. Run `git switch -c feat/<name> main`. Use local `main`.
2. Copy the screenshots to `docs/prototypes/<name>/`.
3. Write `docs/prototypes/<name>.md` from `references/handoff-template.md`. Set the Reference
   section to `proto/<name>` and the SHA from `git rev-parse proto/<name>`.
4. Stage only `docs/prototypes/<name>.md` and `docs/prototypes/<name>/`. Commit with
   `docs: add <name> prototype handoff`. Never use `--no-verify`.

## 6. Stop the server

Run `lsof -ti tcp:3001`. If it prints nothing, go on.

For each pid, run `ps -o command= -p <pid>` and `lsof -a -p <pid> -d cwd -Fn`. Stop the process
with `kill <pid>` only if the command is Vite and the working directory is this repo
(`git rev-parse --show-toplevel`). Otherwise show the command and ask before stopping it.

## 7. Preview

Show:

- Handoff path: `docs/prototypes/<name>.md`
- Branch: `feat/<name>`
- Issue title: `Prototype handoff: <name>`
- Label: `prototype`

Ask: push, edit, or decline.

- Push: go to step 8.
- Edit: apply the change to the handoff, stage `docs/prototypes/<name>.md` and
  `docs/prototypes/<name>/`, run `git commit --amend --no-edit`, and show the preview again.
- Decline: go to step 9. The commit stays local.

## 8. Push and issue

Stop at the first failure and go to step 9 with a failure. Keep the commit.

1. Run `gh auth status`.
2. Run `gh label list --search prototype`. If `prototype` is missing, run
   `gh label create prototype --color 5319e7 --description "Prototype handoff"`.
3. Run `git push -u origin feat/<name>`. Push only that branch. Never push a `proto/*` ref.
4. Get the SHA with `git rev-parse HEAD` and the repo with
   `gh repo view --json nameWithOwner -q .nameWithOwner`.
5. Copy the handoff to a file in the session scratchpad. In the copy, rewrite each image link
   `<name>/<file>.png` to
   `https://github.com/<owner>/<repo>/blob/<sha>/docs/prototypes/<name>/<file>.png?raw=true`.
6. Find an open issue with the exact title:
   `gh issue list --state open --label prototype --search "in:title \"Prototype handoff: <name>\"" --json number,title,url`.
   Keep only results whose title equals `Prototype handoff: <name>`.
   - One exists: run `gh issue edit <number> --body-file <copy>` and use its URL.
   - None: run
     `gh issue create --title "Prototype handoff: <name>" --label prototype --body-file <copy>`
     and use the URL it prints.

## 9. Wrap up

On success, print `/dev-team:specs <issue-url>`.

On decline or failure, show the error if there is one. Then print both:

- `/prototype graduate`, to retry from `feat/<name>`.
- `/dev-team:specs docs/prototypes/<name>.md`, to use the local file.

On every path, name the current branch (`git branch --show-current`). Remind the user that
`proto/<name>` is kept for them to delete.
