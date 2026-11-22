# MARK_NOT_AN_OBJECT: AI mark is not an object

## What it means

The file has a `modifiedBy` AI mark that is not an object with a tool name and a time. The server writes a valid mark when it saves, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user the `modifiedBy` mark in the file is not valid, and that removing `modifiedBy` from their own copy of the file fixes it.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
