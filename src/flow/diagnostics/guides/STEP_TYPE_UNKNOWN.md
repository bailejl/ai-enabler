# STEP_TYPE_UNKNOWN: Step type is unknown

## What it means

A step in the file has a `type` other than `step`, the only type this version supports. Commands only ever set that type, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a step has an unknown type, and to remove `type` from it, or set it to `step`, in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
