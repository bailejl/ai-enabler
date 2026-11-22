# CMD_INTERNAL_ERROR: The server failed unexpectedly

## What it means

A tool failed with an unexpected error inside the server, so its result is unknown. The project in memory is unchanged.

## Repair with the tools

1. Call `get_project` to check the open project.
2. Repeat the call that failed, once.
3. If it fails again, tell the user the server needs a restart.

## Ask the user first

None.
