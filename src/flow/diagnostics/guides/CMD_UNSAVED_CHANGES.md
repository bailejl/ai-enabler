# CMD_UNSAVED_CHANGES: Project has unsaved changes

## What it means

Opening another file or creating a project was refused, because that would lose the open project's unsaved changes. Nothing was changed.

## Repair with the tools

1. Ask the user whether to keep the unsaved changes or drop them.
2. To keep them, call `save_project`. A project that was never saved needs a `name`.
3. To drop them, call `discard_changes`, but only after the user says to.
4. Then repeat the call that was refused.

## Ask the user first

Whether to keep the unsaved changes or drop them. Dropping cannot be undone, so never call `discard_changes` before they answer.
