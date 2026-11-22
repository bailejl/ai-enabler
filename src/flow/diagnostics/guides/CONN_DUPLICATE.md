# CONN_DUPLICATE: Connection appears twice

## What it means

Two connections join the same source to the same target. If `connect` returned this, the connection already exists and nothing was changed.

## Repair with the tools

1. Call `get_project` to confirm the connection is there. If it is, there is nothing more to do.
2. If `open_project` returned it, tell the user the file repeats a connection, and to remove the repeat in their own copy of the file. Then call `open_project` again.

## Ask the user first

None.
