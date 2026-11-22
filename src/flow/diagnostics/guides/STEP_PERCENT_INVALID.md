# STEP_PERCENT_INVALID: Step percentage is invalid

## What it means

The step's `ca`, the percent complete and accurate, is not a number from 0 to 100.

## Repair with the tools

1. If `add_step` or `set_step_metrics` returned this, call it again with `ca` set to a number from 0 to 100, or leave it out.
2. If `open_project` returned it, tell the user the file has a bad percentage, and to fix it in their own copy of the file. Then call `open_project` again.

## Ask the user first

What percentage the user means, when you do not know it. Do not invent a number.
