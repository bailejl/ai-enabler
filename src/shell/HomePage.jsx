import { useEffect, useId, useMemo, useRef } from 'react'
import { DIALOG, FOCUS, isEmptyList, LIST_STATUS } from '../flow/homeFlow.js'
import { toCardItems } from '../flow/homepageView.js'
import { SORT } from '../flow/projectStore.js'
import Announcer from './Announcer.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
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

// The element marked `data-focus="<target>:<id>"` inside `root`.
const markedElement = (root, { target, id }) =>
  [...(root?.querySelectorAll('[data-focus]') ?? [])].find(
    (element) => element.dataset.focus === `${target}:${id}`,
  )

/**
 * The homepage: the saved projects as cards, with the sort and the card actions. It renders what
 * `useHomepage` gives it. The heading takes focus when the page opens; after that, focus goes
 * where the state's `focus` names.
 */
export default function HomePage({
  state,
  message,
  onSortChange,
  onOpenCreate,
  onOpenRename,
  onOpenDelete,
  onCancelDialog,
  onCreate,
  onRename,
  onDuplicate,
  onConfirmDelete,
  onExport,
}) {
  const headingRef = useRef(null)
  const newProjectRef = useRef(null)
  const bodyRef = useRef(null)
  const sortId = useId()
  useEffect(() => {
    document.title = APP_NAME
    headingRef.current?.focus()
  }, [])
  const { list, sort, dialog, actionProblems, focus } = state
  useEffect(() => {
    if (!focus) return
    const element =
      focus.target === FOCUS.newProject
        ? newProjectRef.current
        : markedElement(bodyRef.current, focus)
    element?.focus()
  }, [focus])
  const isLoading = list.status === LIST_STATUS.loading
  const cardItems = useMemo(() => toCardItems(list.projects), [list.projects])
  const storeProblems = useMemo(
    () => [...list.problems, ...actionProblems],
    [list.problems, actionProblems],
  )
  return (
    <div className="page" style={themeProperties} data-route={ROUTE.HOME}>
      <main ref={bodyRef} className="page__body">
        <h1 ref={headingRef} tabIndex={-1} className="page__heading">
          {APP_NAME}
        </h1>
        <div className="projects__actions">
          <button ref={newProjectRef} type="button" className="button" onClick={onOpenCreate}>
            New project
          </button>
        </div>
        <StoreProblems problems={storeProblems} />
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
          {cardItems.length > 0 && (
            <ul className="projects__list">
              {cardItems.map((item) => (
                <ProjectCard
                  key={item.id}
                  item={item}
                  onRename={onOpenRename}
                  onDuplicate={onDuplicate}
                  onExport={onExport}
                  onDelete={onOpenDelete}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
      <Announcer message={message} />
      {dialog?.type === DIALOG.create && (
        <ProjectNameDialog
          title="New project"
          submitText="Create"
          problems={dialog.problems}
          onSubmit={onCreate}
          onCancel={onCancelDialog}
        />
      )}
      {dialog?.type === DIALOG.rename && (
        <ProjectNameDialog
          title="Rename project"
          submitText="Save"
          initialName={dialog.name}
          problems={dialog.problems}
          onSubmit={onRename}
          onCancel={onCancelDialog}
        />
      )}
      {dialog?.type === DIALOG.delete && (
        <ConfirmDialog
          message={`Delete ${dialog.name}? This can't be undone.`}
          confirmText="Delete"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDialog}
        />
      )}
    </div>
  )
}
