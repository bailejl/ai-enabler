# FILE_UNRELEASED_SCHEMA: File uses an unreleased schema

## What it means

The file claims a schema version that AI Enabler never released, so no upgrade is defined for it. It likely came from a build that was not published.

## Repair with the tools

1. Tell the user the file was not made by a released version of AI Enabler, and to export it again from a released version.
2. Once they have the new file, call `open_project` with its name.

No tool changes the version of a file.

## Ask the user first

None.
