# CMD_NO_PROJECT: No project is open

## What it means

The call needs an open project, and none is open. Nothing was changed.

## Repair with the tools

1. To work on a saved project, call `open_project` with its file name, such as `checkout.json`.
2. To start a new project, call `create_project` with a `name`.
3. Then repeat the call that was refused.

## Ask the user first

Whether to open a saved project, and which file, or to start a new one, and what to call it.
