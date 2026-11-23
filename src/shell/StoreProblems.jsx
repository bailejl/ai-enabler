import { toProblemsView } from '../flow/problemsView.js'
import { formatCount } from '../flow/text.js'
import ProblemsPanel from './ProblemsPanel.jsx'

export const STORE_PROBLEMS_LABEL = 'Storage problems'

/**
 * The problems of the last save that failed, until a save of the project works. It has no
 * Dismiss: the change is still not saved while it shows.
 */
export default function StoreProblems({ problems }) {
  if (problems.length === 0) return null
  const heading = `Not saved: ${formatCount(problems.length, 'problem')}`
  return (
    <ProblemsPanel
      view={toProblemsView(heading, problems)}
      label={STORE_PROBLEMS_LABEL}
      className="store-status"
    />
  )
}
