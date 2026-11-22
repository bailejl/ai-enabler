# FILE_PROJECT_ID_MISSING: Project id is missing

## What it means

The project id (`project.id`) is missing or is not a non-empty string. Commands never change the id, so this comes from the saved file.

## Repair with the tools

1. Tell the user the file has no usable `project.id`, and to give it a non-empty value in their own copy of the file.
2. Once they have done that, call `open_project` again with the file name.
3. If they would rather start over, call `create_project` with a `name`, then rebuild the steps with `add_step` and `connect`.

## Ask the user first

Whether to fix the file or start a new project with `create_project`.
