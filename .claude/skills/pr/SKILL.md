---
name: pr
description: Verify and open a pull request for ai-enabler — runs format check, lint, unit tests, and e2e before creating the PR. Use when the user says "open a PR", "create a PR", or "/pr".
---

# Create PR (ai-enabler)

1. Ensure you are on a feature branch (not `main`); branch first if needed.
2. Run the gates — stop and fix on any failure:
   ```bash
   npm run format:check
   npm run lint
   npm run lint:deep
   npm test
   npm run test:e2e
   ```
3. Push the branch: `git push -u origin HEAD`.
4. Open the PR with `gh pr create --fill`, adding a summary and test-plan checklist.
