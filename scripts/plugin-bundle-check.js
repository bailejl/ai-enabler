import { createHash } from 'node:crypto'

const sha256 = (content) => createHash('sha256').update(content).digest('hex')

// An artifact is stale when the committed bytes do not hash to the same SHA-256 as the fresh
// build, or are missing. A committed file the build did not produce is stale too: the build would
// delete it.
const findStaleArtifacts = ({ built, committed }) => [
  ...Object.entries(built)
    .filter(([name, content]) => {
      const current = committed[name]
      return current === undefined || sha256(current) !== sha256(content)
    })
    .map(([name]) => name),
  ...Object.keys(committed).filter((name) => !Object.hasOwn(built, name)),
]

// `built` and `committed` map each artifact's repo path to its contents. `committed` holds every
// file under the folders the build writes, not only the ones the build produced.
export const checkBundle = ({ built, committed }) => {
  if (Object.keys(built).length === 0) {
    return { ok: false, message: 'The plugin build produced no artifacts, so nothing was checked.' }
  }
  const stale = findStaleArtifacts({ built, committed })
  if (stale.length === 0) return { ok: true, message: 'Plugin bundle is up to date.' }
  return {
    ok: false,
    message: [
      'The plugin build is out of date:',
      ...stale.map((name) => `  ${name}`),
      'Run `npm run build:plugin` and commit the result.',
    ].join('\n'),
  }
}
