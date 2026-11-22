# CONN_LOOP: Connections form a loop

## What it means

A connection closes a cycle, so flow would never end. If `connect` returned this, nothing was changed.

## Repair with the tools

1. Call `get_project` to see the steps and connections, and find the connections that make the loop.
2. Once the user has chosen one to break the loop, call `disconnect` with its `sourceId` and `targetId`.
3. Call `connect` again for the new connection.
4. If `open_project` returned it, tell the user the file has connections that form a loop, and to remove one in their own copy of the file. Then call `open_project` again. Steps 1 to 3 do not apply, because no project is open.

## Ask the user first

Which connection to remove to break the loop, or whether to skip the new connection instead. List the connections in the loop for them. Do not remove one before they answer.
