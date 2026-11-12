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

## Names

- `proto_name` is the prototype's name and never changes. Use `proto_name` for `proto/<proto_name>` and the handoff's Reference section.
- `feat_name` defaults to `proto_name`. Use `feat_name` for `feat/<feat_name>`,
  `docs/prototypes/<feat_name>.md`, the screenshot directory, the commit message, and the issue
  title.
- Both must match `^[a-z0-9]+(-[a-z0-9]+)*$`. Check each name taken from a branch, and each
  replacement the user gives. If one fails, stop or ask again.

## Commands used more than once

Handoff-only check: `git diff --name-only main...<branch>` is not empty and lists only
`docs/prototypes/<feat_name>.md` and `docs/prototypes/<feat_name>/*.png`.

Clean-tree check: `git status --porcelain` is empty. If not, ask the user to commit or discard
first.

Commits: run `SKIP_REPOWISE=1 git commit ...` so the pre-commit hook does not add Repowise files to
a handoff-only commit. Never use `--no-verify`.

Listeners: `lsof -ti tcp:3001 -sTCP:LISTEN` prints the pids.

This repo's Vite: a pid whose `ps -o command= -p <pid>` contains `vite`, and whose cwd equals
`git rev-parse --show-toplevel`. Get the cwd from `lsof -a -p <pid> -d cwd -Fn` and strip the
leading `n`.

## Entry

- On `proto/<proto_name>`: check the name, set `feat_name` to `proto_name`, and start at step 1.
- On `feat/<feat_name>`: check the name, then run the handoff-only check against `HEAD`.
  - Pass: this is a graduated handoff. Run the clean-tree check, then step 6, then step 7. Read
    `proto_name` from the handoff's Reference section.
  - Fail: stop. Say this is not a graduated handoff branch, and show `git status`.
- Anywhere else, including `main`: stop and say to run on a `proto/*` branch.

## 1. Preflight

Run these checks in order. Change nothing until all pass. Stop at the first failure.

1. Run the clean-tree check.
2. `git diff main...HEAD` is not empty. If the diff is empty, say there is nothing to graduate.
3. `feat/<feat_name>` is absent. If that branch exists, run the handoff-only check against
   `feat/<feat_name>`.
   - Pass: ask whether to reuse that branch. Yes: `git switch feat/<feat_name>`, then step 6, then step 7.
   - Fail, or the user says no: ask for another `feat_name`, check it, and run this check again.
4. The server is up.
   - Nothing is listening: run `npm run dev:prototype` in the background. Poll
     `curl -sf http://localhost:3001` for up to about 30 seconds. If the server never answers, stop and show the server output.
   - A pid is listening and it is this repo's Vite: use it.
   - A pid is listening and is not this repo's Vite: show its command and ask whether to stop that process. Yes: `kill` that process and start the server as above. No: stop.

## 2. Advisory agents

Ask one question: "Run ui-ux-designer, a11y-review, and exploratory-testing against the
prototype? Default is yes. Reply with agent names to drop, or 'no' for none."

Run the accepted ones in parallel. Give each `http://localhost:3001` and `git diff main...HEAD`.

- `dev-team:ui-ux-designer` and `dev-team:a11y-review`: run as subagents.
- `dev-team:exploratory-testing`: invoke with the Skill tool and
  `--charter "Explore <target> with <approach> to discover <concern>"`, filled in from the diff and commits. It writes a report under
  `.dev-team-reports/` (gitignored). Read the findings from that report.

Keep each agent's findings text. Record a declined agent as "Not run". Record an agent that
errors, times out, or returns nothing as "<agent>: Did not complete". No outcome blocks graduate.

## 3. Interview

Draft every handoff section from `git diff main...HEAD` and the bodies from `git log main..HEAD`.
Show the draft. Ask only about gaps the code and commits cannot answer, such as why a choice was
made. Treat a "skip" or "unsure" answer as unanswered and add it to Open questions.

## 4. Screenshots

Use the Playwright MCP tools to capture each distinct state at `http://localhost:3001`. Save the
PNG files to `.playwright-mcp/` in the repo root, which is gitignored. The tool saves only under
the repo root. Give each a short kebab-case name and a one-line description.

## 5. Branch and handoff

1. Run `git switch -c feat/<feat_name> main`. Use local `main`.
2. Copy the screenshots from `.playwright-mcp/` to `docs/prototypes/<feat_name>/`.
3. Write `docs/prototypes/<feat_name>.md` from `references/handoff-template.md`. Put each agent's
   findings in "UX and a11y notes". Set the Reference section to `proto/<proto_name>` and the SHA
   from `git rev-parse proto/<proto_name>`.
4. Stage only `docs/prototypes/<feat_name>.md` and `docs/prototypes/<feat_name>/`. Commit with
   `docs: add <feat_name> prototype handoff`.

## 6. Stop the server

Run the listeners command. If that command prints nothing, go on.

For each pid, stop it with `kill <pid>` only if it is this repo's Vite. Otherwise show its command and ask before stopping that process.

## 7. Preview

Show:

- Handoff path: `docs/prototypes/<feat_name>.md`
- Branch: `feat/<feat_name>`
- Issue title: `Prototype handoff: <feat_name>`
- Label: `prototype`
- The full handoff body

Ask: push, edit, or decline.

- Push: go to step 8.
- Edit: apply the change to the handoff and stage the handoff paths. If
  `git rev-parse --abbrev-ref @{u}` succeeds, the branch is already pushed: make a new commit,
  `docs: update <feat_name> prototype handoff`. Otherwise run
  `SKIP_REPOWISE=1 git commit --amend --no-edit`. Then show the preview again.
- Decline: go to step 9. The commit stays local.

## 8. Push and issue

Stop at the first failure and go to step 9 with a failure. Keep the commit.

1. Run `gh auth status`.
2. Get the SHA with `git rev-parse HEAD`. Get the repo with
   `gh repo view --json nameWithOwner,visibility`. If the repo is private, say that the image links may
   not render in the issue.
3. Copy the handoff to a file in the session scratchpad. In the copy, rewrite each image link
   `<feat_name>/<file>.png` to
   `https://github.com/<owner>/<repo>/blob/<sha>/docs/prototypes/<feat_name>/<file>.png?raw=true`.
4. Scan the handoff and the copy. On any match, stop and show the match.
   - Absolute paths: `/Users/`, `/home/`, `/private/tmp`, `/var/folders`.
   - Key shapes: `(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`,
     `ghp_[A-Za-z0-9]{36}`, `gho_[A-Za-z0-9]{36}`, `github_pat_[A-Za-z0-9_]{20,}`, and
     `-----BEGIN [A-Z ]*PRIVATE KEY-----`.
5. Run `gh label create prototype --color 5319e7 --description "Prototype handoff" --force`. It
   is safe to run when the label exists.
6. Run `git push -u origin feat/<feat_name>`. Push only that branch. Never push a `proto/*` ref.
7. List your open issues: `gh issue list --state open --author @me --limit 200 --json number,title,url`. Keep only results whose title equals `Prototype handoff: <feat_name>`. Reuse an issue only if you wrote it.
   - One exists: run `gh issue edit <number> --body-file <copy>` and use its URL.
   - None: run
     `gh issue create --title "Prototype handoff: <feat_name>" --label prototype --body-file <copy>`
     and use the URL that command prints.

## 9. Wrap up

On success, print `/dev-team:specs <issue-url>`.

On decline or failure, show the error if there is one. Then print both:

- `/prototype graduate`, to retry from `feat/<feat_name>`.
- `/dev-team:specs docs/prototypes/<feat_name>.md`, to use the local file.

On every path, name the current branch (`git branch --show-current`). Remind the user that
`proto/<proto_name>` is kept for them to delete.
