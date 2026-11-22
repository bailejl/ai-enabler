# CONN_SELF: Connection joins a step to itself

## What it means

A connection has the same step as its source and its target. A step cannot flow into itself. If `connect` returned this, nothing was changed.

## Repair with the tools

1. Call `get_project` to get the ids of the steps.
2. Call `connect` with `sourceId` and `targetId` set to two different steps.
3. If `open_project` returned it, tell the user the file has a step connected to itself, and to remove that connection in their own copy of the file. Then call `open_project` again.

## Ask the user first

Which other step the connection should go to. Do not choose one.
