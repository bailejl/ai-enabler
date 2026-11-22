# FILE_NAME_NOT_ALLOWED: File name is not allowed

## What it means

The tool takes a plain file name only, for a regular file in the projects folder. This name has a path or other characters that are not allowed, or it points at a link rather than a regular file.

## Repair with the tools

1. Use a plain name: it starts with a letter or digit, uses only letters, digits, dots, hyphens and underscores, and ends in `.json`.
2. Call `open_project` or `save_project` again with that `name`.

If the name was already a plain name, the file is a link or has a second name, and the server refuses it. Pick a different file.

## Ask the user first

Which file name to use, when the name came from the user.
