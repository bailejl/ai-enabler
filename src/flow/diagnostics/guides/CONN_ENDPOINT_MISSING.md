# CONN_ENDPOINT_MISSING: Connection points to a missing step

## What it means

A connection in the file has a `source` or `target` that is not the id of any step. The tools never leave one behind, because `remove_step` also removes the step's connections, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a connection points to a step that is not in the file, and to point it at a step in the file, or remove it, in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
