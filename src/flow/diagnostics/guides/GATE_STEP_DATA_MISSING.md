# GATE_STEP_DATA_MISSING: Step is missing data

## What it means

A step has no value for one or more of `pt`, `lt`, `ca` and `queue`. The values are optional and can be added later, so nothing is broken.

## Repair with the tools

1. Read the problem's message: it names the step and the missing fields.
2. Get the values from the user. `pt` and `lt` are whole minutes of working time (1 day is 480), `ca` is a percent from 0 to 100, and `queue` is a whole number of items.
3. Call `set_step_metrics` with the step's `stepId` and those values.

## Ask the user first

What value to use for each missing field, or whether to leave them empty for now. Do not invent numbers.
