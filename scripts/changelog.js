const SECTION_HEADING = /^## \[(.+?)\]/

// Returns the body of the `## [<version>]` section, or null when there is none.
export const versionSection = (text, version) => {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => SECTION_HEADING.exec(line)?.[1] === version)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => SECTION_HEADING.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}
