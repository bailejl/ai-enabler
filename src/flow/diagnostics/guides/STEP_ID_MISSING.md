# STEP_ID_MISSING: Step id is missing

## What it means

A step in the file has no id, or its id is not text. The server makes every step id, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a step in the file has no usable id, and to give it a unique text id in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
