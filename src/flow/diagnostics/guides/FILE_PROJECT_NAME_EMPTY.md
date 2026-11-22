# FILE_PROJECT_NAME_EMPTY: Project name is empty

## What it means

The project name (`project.name`) is missing, not text, or blank. A project must have a name that is not blank.

## Repair with the tools

1. If `create_project` returned this problem, call it again with a `name` that is not blank.
2. If `open_project` returned it, the saved file has the empty name. Tell the user to give `project.name` a value in their own copy of the file, then call `open_project` again.

## Ask the user first

What the project should be named, when `create_project` needs a new name.
