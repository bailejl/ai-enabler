# STEP_LABEL_MISSING: Step label is missing

## What it means

A step in the file has no label, or its label is not text. The label is the step's name. The `add_step` and `update_step` tools always set one, so this comes from a saved file that was changed outside AI Enabler.

## Repair with the tools

1. Tell the user a step has no name, and to set `data.label` to text in their own copy of the file.
2. Once they have, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
