import { useEffect, useId, useMemo, useRef } from 'react'
import { DIALOG, isEmptyList, LIST_STATUS } from '../flow/homeFlow.js'
import { toCardItems } from '../flow/homepageView.js'
import { SORT } from '../flow/projectStore.js'
import { APP_NAME } from './Header.jsx'
import ProjectCard from './ProjectCard.jsx'
import ProjectNameDialog from './ProjectNameDialog.jsx'
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
export default function HomePage({ state, onSortChange, onOpenCreate, onCancelCreate, onCreate }) {
  const headingRef = useRef(null)
  const newProjectRef = useRef(null)
  const sortId = useId()
  useEffect(() => {
    document.title = APP_NAME
    headingRef.current?.focus()
  }, [])
  const { list, sort, dialog } = state
  // Once the create dialog has gone (and the browser has put focus back), focus is on New project.
  const wasCreateOpen = useRef(false)
  useEffect(() => {
    const isCreateOpen = dialog?.type === DIALOG.create
    if (wasCreateOpen.current && !isCreateOpen) newProjectRef.current?.focus()
    wasCreateOpen.current = isCreateOpen
  }, [dialog])
  const isLoading = list.status === LIST_STATUS.loading
  const cardItems = useMemo(() => toCardItems(list.projects), [list.projects])
  return (
    <div className="page" style={themeProperties} data-route={ROUTE.HOME}>
      <main className="page__body">
        <h1 ref={headingRef} tabIndex={-1} className="page__heading">
          {APP_NAME}
        </h1>
        <div className="projects__actions">
          <button ref={newProjectRef} type="button" className="button" onClick={onOpenCreate}>
            New project
          </button>
        </div>
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
              {cardItems.map((item) => (
                <ProjectCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      </main>
      {dialog?.type === DIALOG.create && (
        <ProjectNameDialog
          title="New project"
          submitText="Create"
          problems={dialog.problems}
          onSubmit={onCreate}
          onCancel={onCancelCreate}
        />
      )}
    </div>
  )
}
