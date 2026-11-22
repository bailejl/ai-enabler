import { createHash } from 'node:crypto'

const sha256 = (content) => createHash('sha256').update(content).digest('hex')

// `built` and `committed` map each artifact's repo path to its contents. An artifact is stale when
// the committed bytes do not hash to the same SHA-256 as the fresh build, or are missing.
export const findStaleArtifacts = ({ built, committed }) =>
  Object.entries(built)
    .filter(([name, content]) => {
      const current = committed[name]
      return current === undefined || sha256(current) !== sha256(content)
    })
    .map(([name]) => name)

export const staleMessage = (stale) =>
  [
    'The plugin build is out of date:',
    ...stale.map((name) => `  ${name}`),
    'Run `npm run build:plugin` and commit the result.',
  ].join('\n')
