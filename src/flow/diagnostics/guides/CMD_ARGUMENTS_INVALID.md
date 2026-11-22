# CMD_ARGUMENTS_INVALID: Command arguments are not an object

## What it means

The arguments were sent as something other than an object of named values, such as a list or a bare text. Nothing was changed.

## Repair with the tools

1. Send the arguments as one object whose keys are the argument names, such as `name` for `add_step`.
2. Call the same tool again.

## Ask the user first

None.
