# FILE_NAME_TAKEN: File name is taken

## What it means

`save_project` was given a new name, and a file with that name already exists in the projects folder. Saving under another name never overwrites a file, so nothing was saved. The project is still open with its unsaved changes.

## Repair with the tools

1. Get a new file name that is not taken, from the user.
2. Call `save_project` again with that `name`.

## Ask the user first

Which new file name to save under. Do not pick one for them, and do not try other names until one works.
