# Schema versioning

Exported project files carry a `schemaVersion` (SemVer). Importing an older file runs it through a chain of upgrade functions to the current version.

## Content hash

Schema 0.0.0 includes a top-level `contentHash`: `sha256-` plus the lowercase hex SHA-256 of the file's canonical JSON. Canonical JSON has object keys sorted at every level, no whitespace, array order kept, and the top-level `contentHash` left out, encoded as UTF-8 (`src/flow/contentHash.js`). Export writes it last; import ignores it when rebuilding the map.

On import the app recomputes the hash over the file as read, before any upgrade, and compares it with the stored value. A missing, non-string, or different `contentHash` marks the file as edited, and the confirmation and the outcome line say so. The import still goes ahead on confirm. A bad `contentHash` never makes a file invalid.

The hash detects edits, not tampering. Anyone who changes a file can recompute and replace the hash, so it is not a security control.

An upgrade does not rewrite `contentHash`: the stored value stays the hash of the file as exported. A fixture that has no upgrade hop keeps a valid hash. When an upgrade changes a fixture's data, the expected snapshot keeps the input's hash, which no longer matches the upgraded file. That is correct, because the check runs before the upgrade.

Fixtures carry a valid `contentHash`. After editing a fixture, recompute it with `contentHash` from `src/flow/contentHash.js`. `importFile.test.js` fails for a released fixture whose hash does not match.

## AI mark (`modifiedBy`)

Schema 0.1.0 adds the optional top-level `modifiedBy: { tool, at }`, written by tools that change a project file for the user (the MCP server (`mcp/`) writes `tool: "aie-mcp"`). `tool` is 1 to 40 letters, digits, dots, dashes or underscores (the app's AI notice shows it, so other text is rejected) and `at` is an ISO 8601 date and time with a `Z` or offset zone. The content hash covers `modifiedBy`, so the mark must be added before the hash.

- A file with no mark is valid. A present mark that is not an object, or has a bad `tool` or `at`, is a problem (`MARK_NOT_AN_OBJECT`, `MARK_TOOL_INVALID`, `MARK_TIME_INVALID`). Each message names the bad part and says that removing the `modifiedBy` field fixes the file.
- The 0.0.0 to 0.1.0 hop copies every field and drops a `modifiedBy` on a 0.0.0 file. 0.0.0 never defined the mark, so a stray one is ignored, never validated and never honored.
- The app's export never writes a mark.

## Bump levels

- **Major:** a breaking change, such as a field removed, renamed, or its meaning changed.
- **Minor:** a backward-compatible addition, such as a new optional field.
- **Patch:** a fix with no shape change.

Every bump, at any level, adds an upgrade function (identity is allowed) and a fixture.

A version that adds an optional field also gets a second fixture with the field set, named `<version>-marked.json` for the mark. The plain `<version>.json` matches the app's export and carries no optional field; the marked one carries the field and nothing else extra. Both hold a valid `contentHash`, and each gets its own snapshot under `fixtures/expected/`.

## Bump the schema

1. Add a fixture for the new version: `src/flow/schema/fixtures/<new>.json`. Copy the shape of the export at that version, including a valid `contentHash`. When the version adds an optional field, add the `<new>-marked.json` variant too.
2. In `src/flow/schema/version.js`, add the new version to `RELEASED_SCHEMA_VERSIONS` and set `CURRENT_SCHEMA_VERSION` to it.
3. Add a hop to `REGISTRY` in `src/flow/schema/upgrades.js`. Its shape is below. The real 0.0.0 to 0.1.0 hop is `{ from: '0.0.0', to: '0.1.0', upgrade: dropModifiedBy }`.

   ```js
   { from: '<old>', to: '<new>', upgrade: (file) => ({ ...file /* the data change */ }) }
   ```

   - The upgrade is pure: it must not mutate its input, and it returns a plain object.
   - Return only the data change. The chain stamps `schemaVersion` itself.
   - Hops run oldest first with no gaps, one `from` each, and `from` below `to`.

4. Regenerate the expected snapshots (below).
5. Publish the JSON Schema as `public/schema/project-<new>.json`, and point the hard-coded `project-<version>.json` paths at it: `SCHEMA_SOURCE` in `vite.mcp.config.js`, `PUBLISHED_SCHEMA_URL` in `src/flow/schema/testHelpers.js`, `PLUGIN_SCHEMA` in `scripts/plugin-bundle-check.test.js`, and the schema paths in `parity.test.js`, `jsonSchema.test.js` and `mcp/plugin-manifest.test.js`. Keep `parity.test.js` and `jsonSchema.test.js` green: they check that every writable schema field has a command and that the schema agrees with the validator.
6. Update `public/llms.txt` for the new version. A new writable field also needs a command, an MCP tool argument and an `llms.txt` entry (the Definition of Done rule in `.claude/CLAUDE.md`).
7. Run `npm run build:plugin`. It rebuilds `plugin/server/aie-mcp.js` and copies the schema to `plugin/schema/`, emptying that folder first so the old version does not linger. Commit the result, because CI runs `npm run check:plugin`.
8. On a major bump, update `Supported schema major` in `plugin/skills/aie-guide/SKILL.md` and `plugin/skills/aie-review/SKILL.md`. `mcp/plugin-manifest.test.js` checks that they match the schema.
9. Run `npm test`. The registry and fixture checks in `upgrades.test.js` fail if a released version has no fixture or no upgrade path to current.

## Expected snapshots

Each input fixture (marked variants included) is upgraded to current and compared with `src/flow/schema/fixtures/expected/<name>.json`. After adding a hop, regenerate:

```sh
npx vitest run -u src/flow/schema/upgrades.test.js
```

Then read the diff. A regenerated snapshot blesses whatever the upgrade now does, so check that each change is intended.

**Any change under `fixtures/expected/` needs explicit reviewer sign-off.** CI does not guard that folder, so review is the only check.

## Input fixtures are immutable

A released fixture stands for files users already hold. Editing it would hide a break in the upgrade chain, so never change one after release. To change the schema, add a new version and fixture.

`scripts/schema-fixture-guard-cli.js` enforces this in CI on pull requests. It diffs against `origin/main` and fails on any status other than add for a top-level `src/flow/schema/fixtures/*.json` file (modify, delete, rename, copy, type change). `fixtures/expected/` is exempt.

On a push to `main` the diff against `origin/main` is empty by design, so the guard passes. `main` relies on branch protection (required PR checks) to keep released fixtures unchanged.

## Export shape check

`src/flow/schema/shape.test.js` compares the key paths and value types of a starter project export with the unmarked fixture for `CURRENT_SCHEMA_VERSION`, and checks that the marked fixture adds only the `modifiedBy` paths to it. If the export shape changes without a version bump and a new fixture, that test fails.

The test only catches changes to fields that the starter export or the fixture contains. A new optional data field that neither sets is not caught.
