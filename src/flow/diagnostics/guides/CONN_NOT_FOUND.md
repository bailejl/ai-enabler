# CONN_NOT_FOUND: Connection does not exist

## What it means

A command asked to remove a connection from one step to another, and no connection in the open project matches. Connections run one way, from source to target. Nothing was changed.

## Repair with the tools

1. Call `get_project` to see the connections and the ids of their steps.
2. Confirm with the user which connection to remove.
3. Call `disconnect` again with `sourceId` as the step it leaves and `targetId` as the step it enters.

## Ask the user first

Which connection to remove, when the ids you used are not certain. Confirm it before calling `disconnect` again.
