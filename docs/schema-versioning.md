# Schema versioning

Exported project files carry a `schemaVersion` (SemVer). Importing an older file runs it through a chain of upgrade functions to the current version.

## Bump levels

- **Major:** a breaking change, such as a field removed, renamed, or its meaning changed.
- **Minor:** a backward-compatible addition, such as a new optional field.
- **Patch:** a fix with no shape change.

Every bump, at any level, adds an upgrade function (identity is allowed) and a fixture.

## Bump the schema

1. Add a fixture for the new version: `src/flow/schema/fixtures/<new>.json`. Copy the shape of the export at that version.
2. In `src/flow/schema/version.js`, add the new version to `RELEASED_SCHEMA_VERSIONS` and set `CURRENT_SCHEMA_VERSION` to it.
3. Add a hop to `REGISTRY` in `src/flow/schema/upgrades.js`:

   ```js
   { from: '0.0.0', to: '0.1.0', upgrade: (file) => ({ ...file, notes: '' }) }
   ```

   - The upgrade is pure: it must not mutate its input, and it returns a plain object.
   - Return only the data change. The chain stamps `schemaVersion` itself.
   - Hops run oldest first with no gaps, one `from` each, and `from` below `to`.

4. Regenerate the expected snapshots (below).
5. Run `npm test`. The registry and fixture checks in `upgrades.test.js` fail if a released version has no fixture or no upgrade path to current.

## Expected snapshots

Each released input fixture is upgraded to current and compared with `src/flow/schema/fixtures/expected/<v>.json`. After adding a hop, regenerate:

```sh
npx vitest run -u src/flow/schema/upgrades.test.js
```

Then read the diff. A regenerated snapshot blesses whatever the upgrade now does, so check that each change is intended.

**Any change under `fixtures/expected/` needs explicit reviewer sign-off.** CI does not guard that folder, so review is the only check.

## Input fixtures are immutable

A released fixture stands for files users already hold. Editing it would hide a break in the upgrade chain, so never change one after release. To change the schema, add a new version and fixture.

`scripts/schema-fixture-guard-cli.js` enforces this in CI. It diffs against `origin/main` and fails on any status other than add for a top-level `src/flow/schema/fixtures/*.json` file (modify, delete, rename). `fixtures/expected/` is exempt.

## Export shape check

`src/flow/schema/shape.test.js` compares the key paths and value types of a starter project export with the fixture for `CURRENT_SCHEMA_VERSION`. If the export shape changes without a version bump and a new fixture, that test fails.
