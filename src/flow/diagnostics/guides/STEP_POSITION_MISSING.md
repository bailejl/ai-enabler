# STEP_POSITION_MISSING: Step position is missing

## What it means

A step in the file has no numeric `x` and `y` position. Commands never set positions, and the server lays steps out again on every save, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a step has no position, and to give it a position with numeric `x` and `y` in their own copy of the file. Any numbers work.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
