import { useEffect, useRef } from 'react'
import { OPEN_OUTCOME } from '../flow/projectLibrary.js'
import { toProblemsView } from '../flow/problemsView.js'
import { formatCount } from '../flow/text.js'
import { toDocumentTitle } from './Header.jsx'
import ProblemsPanel from './ProblemsPanel.jsx'
import { ROUTE } from './routes.js'
import { themeStyle } from './tokens.js'

const themeProperties = themeStyle()
const NOT_FOUND = 'Project not found'
const UNNAMED = 'this project'

const headingFor = (outcome) =>
  outcome.type === OPEN_OUTCOME.missing ? NOT_FOUND : `Can't open ${outcome.name ?? UNNAMED}`

/**
 * The page for a project link that shows no map: an id that is not stored, or a stored file that
 * cannot be opened. The heading takes focus, and the problems are listed with their fixes.
 * @param {{ outcome: ReturnType<typeof import('../flow/projectLibrary.js').toOpenOutcome> }} props
 */
export default function ProjectMissing({ outcome }) {
  const heading = headingFor(outcome)
  const headingRef = useRef(null)
  useEffect(() => {
    document.title = toDocumentTitle(heading)
    headingRef.current?.focus()
  }, [heading])
  return (
    <div className="page" style={themeProperties} data-route={ROUTE.PROJECT}>
      <main className="page__body">
        <h1 ref={headingRef} tabIndex={-1} className="page__heading">
          {heading}
        </h1>
        <p>
          <a href="#/">Go to the homepage</a>
        </p>
        <ProblemsPanel
          view={toProblemsView(formatCount(outcome.problems.length, 'problem'), outcome.problems)}
          label="Project problems"
        />
      </main>
    </div>
  )
}
