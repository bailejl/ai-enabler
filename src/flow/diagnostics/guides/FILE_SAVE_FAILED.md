# FILE_SAVE_FAILED: File could not be saved

## What it means

Writing the project file failed. The project is still open in memory with its unsaved changes, and nothing was lost.

## Repair with the tools

1. Tell the user the save failed, and to check that the projects folder exists and can be written to.
2. Once they say it can, call `save_project` again.

Keep the unsaved changes while you wait: do not open another project or start a new one.

## Ask the user first

None.
