# Handoff template

Graduate fills this in and writes it to `docs/prototypes/<name>.md`. Keep all nine headings.

````markdown
# Prototype handoff: <name>

## Goal

<What the prototype tried to learn.>

## Behavior

<What the user can do, step by step.>

## Flow

<Screens or canvas states, and how the user moves between them.>

## UI

<Layout and interaction notes. Add one entry per screenshot:>

![<description>](<name>/<file>.png)
<One-line text description of the screenshot.>

## UX and a11y notes

- ui-ux-designer: <findings | Not run | Did not complete>
- a11y-review: <findings | Not run | Did not complete>
- exploratory-testing: <findings | Not run | Did not complete>

## Decisions

- <Choice made>: <why>. Rejected: <option tried or considered, and why not>.

## Data shape

<Any value stream data structures the prototype invented.>

## Open questions

- <What the prototype did not answer, plus every "skip" and "unsure" answer.>

## Reference

- Branch: `proto/<name>`
- Final commit: <SHA>
- Prototype code is reference only; rebuild through /dev-team:specs, do not merge.
- This file is the source; the issue is a copy.
````

### Fill-in rules

- A section with nothing to say reads "Not run" or "See Open questions".
- One line per agent in "UX and a11y notes". Use `<agent>: Not run` when the user declined it.
  Use `<agent>: Did not complete` when it errored, timed out, or returned nothing.
- Every screenshot has an image line and a one-line text description.
- Scrub it: no absolute paths, environment values, or credentials.
