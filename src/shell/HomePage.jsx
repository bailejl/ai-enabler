import { useEffect, useId, useRef } from 'react'
import { isEmptyList, LIST_STATUS } from '../flow/homeFlow.js'
import { toCardItems } from '../flow/homepageView.js'
import { SORT } from '../flow/projectStore.js'
import { APP_NAME } from './Header.jsx'
import ProjectCard from './ProjectCard.jsx'
import { ROUTE } from './routes.js'
import StoreProblems from './StoreProblems.jsx'
import { themeStyle } from './tokens.js'

const themeProperties = themeStyle()
export const EMPTY_LIST_TEXT = 'No projects yet. Create one or import a project file.'
const SORT_OPTIONS = [
  { value: SORT.modified, label: 'Last modified' },
  { value: SORT.name, label: 'Name' },
]

/**
 * The homepage: the saved projects as cards, with the sort. It renders what `useHomepage` gives
 * it. The heading takes focus when the page opens.
 */
export default function HomePage({ state, onSortChange }) {
  const headingRef = useRef(null)
  const sortId = useId()
  useEffect(() => {
    document.title = APP_NAME
    headingRef.current?.focus()
  }, [])
  const { list, sort } = state
  const isLoading = list.status === LIST_STATUS.loading
  return (
    <div className="page" style={themeProperties} data-route={ROUTE.HOME}>
      <main className="page__body">
        <h1 ref={headingRef} tabIndex={-1} className="page__heading">
          {APP_NAME}
        </h1>
        <StoreProblems problems={list.problems} />
        <section aria-label="Projects" aria-busy={isLoading} className="projects">
          <div className="projects__toolbar">
            <label htmlFor={sortId}>Sort by</label>
            <select id={sortId} value={sort} onChange={(event) => onSortChange(event.target.value)}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p role="status" className="projects__status">
            {isLoading ? 'Loading projects…' : ''}
            {isEmptyList(state) ? EMPTY_LIST_TEXT : ''}
          </p>
          {list.projects.length > 0 && (
            <ul className="projects__list">
              {toCardItems(list.projects).map((item) => (
                <ProjectCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
