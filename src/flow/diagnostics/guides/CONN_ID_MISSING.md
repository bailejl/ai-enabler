# CONN_ID_MISSING: Connection id is missing

## What it means

A connection in the file has no id, or its id is not a non-empty text. The server makes every connection id, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a connection in the file has no usable id, and to give it a unique text id in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
