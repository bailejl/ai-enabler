# GATE_PROJECT_EMPTY: Project has no steps

## What it means

A gate ran on a project with no steps, so there is nothing to check.

## Repair with the tools

1. Get the steps from the user, with their names.
2. Call `add_step` with a `name` for each one, and `connect` to join them in order.
3. Call `list_problems` again.

## Ask the user first

Which steps the project should have. Do not invent them.
