# FILE_UPGRADE_FAILED: Upgrade failed

## What it means

AI Enabler tried to convert the file to the current schema and the conversion failed partway. The file itself is unchanged.

## Repair with the tools

1. Tell the user the file could not be converted, and to export it again from the app or version that created it.
2. Once they have the new file, call `open_project` with its name.

Do not retry `open_project` with the same file: it fails the same way.

## Ask the user first

None.
