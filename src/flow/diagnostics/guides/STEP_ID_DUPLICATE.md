# STEP_ID_DUPLICATE: Step id is used twice

## What it means

Two steps in the file share one id, so a connection cannot tell which one it means. The server makes every step id, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user two steps share an id, and to give each step its own id in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
