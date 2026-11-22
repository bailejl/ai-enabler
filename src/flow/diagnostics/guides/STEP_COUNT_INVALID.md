# STEP_COUNT_INVALID: Step count is invalid

## What it means

One of the step's `pt`, `lt`, `queue` or `batch` is not a whole number of 0 or more. `pt` and `lt` are minutes of working time (1 hour is 60, 1 day is 480); `queue` and `batch` are items.

## Repair with the tools

1. If `add_step` or `set_step_metrics` returned this, call it again with a whole number of 0 or more for the field the problem names, or leave the field out.
2. If `open_project` returned it, tell the user the file has a bad number, and to fix it in their own copy of the file. Then call `open_project` again.

## Ask the user first

What value the user means, when you do not know it. Do not invent a number.
