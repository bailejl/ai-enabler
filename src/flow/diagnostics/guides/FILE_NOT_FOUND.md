# FILE_NOT_FOUND: File not found

## What it means

The file is not in the projects folder, or it could not be read. This is also the answer for a name that points at a missing or unusable folder.

## Repair with the tools

1. Get the exact file name from the user, such as `checkout.json`. The file must be in the projects folder.
2. Call `open_project` again with that `name`.

No tool lists the projects folder, so do not guess other names.

## Ask the user first

The exact name of the file, and whether it is in the projects folder.
