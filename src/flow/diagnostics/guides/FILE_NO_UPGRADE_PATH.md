# FILE_NO_UPGRADE_PATH: No upgrade path for the file

## What it means

The file is from an older schema version, and no chain of upgrades leads from it to the current one, so it cannot be converted.

## Repair with the tools

1. Tell the user this file is too old to convert, and to export it again from a released version of AI Enabler.
2. Once they have the new file, call `open_project` with its name.

No tool changes the version of a file.

## Ask the user first

None.
