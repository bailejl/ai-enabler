import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HOME_EVENT,
  INITIAL_HOME_STATE,
  actionAnnouncement,
  focusAfterRemove,
  isStoreRefusal,
  isUnopenable,
  reduceHome,
} from '../flow/homeFlow.js'
import { projectHref } from '../flow/homepageView.js'
import { downloadTextFile } from './download.js'
import { STORE_STATUS, useStore } from './StoreProvider.jsx'

/**
 * Wires the homepage reducer to the library: loads the list once the store is ready, again after
 * the sort changes and after each card action that writes. A list that comes back after a newer
 * one was asked for is dropped. Each load runs once per sort, even under StrictMode's second
 * effect run, so a failure reports once. One card action runs at a time; a second click while one
 * is pending is ignored.
 * @param {{ announce: (text: string) => void }} options
 */
export const useHomepage = ({ announce }) => {
  const { status, library } = useStore()
  const [state, setState] = useState(INITIAL_HOME_STATE)
  const latestState = useRef(state)
  const dispatch = useCallback((event) => {
    latestState.current = reduceHome(latestState.current, event)
    setState(latestState.current)
  }, [])
  const loadedSort = useRef(null)
  const latestRequest = useRef(0)
  const loadList = useCallback(
    async (sort) => {
      latestRequest.current += 1
      const request = latestRequest.current
      const listed = await library.list({ sort })
      if (request !== latestRequest.current) return
      dispatch({
        type: HOME_EVENT.listLoaded,
        projects: listed.ok ? listed.projects : [],
        problems: listed.problems,
      })
    },
    [library, dispatch],
  )
  const { sort } = state
  useEffect(() => {
    if (status !== STORE_STATUS.ready || loadedSort.current === sort) return
    loadedSort.current = sort
    loadList(sort)
  }, [status, sort, loadList])
  const reload = useCallback(() => loadList(latestState.current.sort), [loadList])

  const pending = useRef(false)
  // Runs one card action at a time; one asked for while another is pending is dropped.
  const runExclusive = useCallback(async (action) => {
    if (pending.current) return
    pending.current = true
    try {
      await action()
    } finally {
      pending.current = false
    }
  }, [])
  // A refused card action: its problems show under "Storage problems" and focus returns to it. A
  // file found unopenable since the list loaded reloads it, so its card offers only repairs.
  const failed = useCallback(
    async (id, problems) => {
      if (isUnopenable(problems)) await reload()
      dispatch({ type: HOME_EVENT.actionFailed, id, problems })
    },
    [dispatch, reload],
  )

  const setSort = useCallback(
    (next) => dispatch({ type: HOME_EVENT.sortChanged, sort: next }),
    [dispatch],
  )
  const openCreate = useCallback(() => dispatch({ type: HOME_EVENT.createOpened }), [dispatch])
  const openRename = useCallback(
    (id, name) => dispatch({ type: HOME_EVENT.renameOpened, id, name }),
    [dispatch],
  )
  const openDelete = useCallback(
    (id, name) => dispatch({ type: HOME_EVENT.deleteOpened, id, name }),
    [dispatch],
  )
  const cancelDialog = useCallback(() => dispatch({ type: HOME_EVENT.dialogCancelled }), [dispatch])

  // A create that works opens the new project's link; a refused one keeps the dialog open.
  const create = useCallback(
    async (name) => {
      const created = await library.create(name)
      if (created.ok) window.location.hash = projectHref(created.project.project.id)
      else dispatch({ type: HOME_EVENT.nameRefused, problems: created.problems })
    },
    [library, dispatch],
  )

  // A refused name keeps the dialog open; a refused write closes it and shows the problem.
  const rename = useCallback(
    async (name) => {
      const { id } = latestState.current.dialog
      const renamed = await library.rename(id, name)
      if (renamed.ok) {
        await reload()
        dispatch({ type: HOME_EVENT.renamed, id })
      } else if (isStoreRefusal(renamed.problems)) failed(id, renamed.problems)
      else dispatch({ type: HOME_EVENT.nameRefused, problems: renamed.problems })
    },
    [library, reload, dispatch, failed],
  )

  const duplicate = useCallback(
    async (id, name) => {
      const copied = await library.duplicate(id)
      if (!copied.ok) return failed(id, copied.problems)
      await reload()
      dispatch({ type: HOME_EVENT.duplicated, id: copied.project.project.id })
      announce(actionAnnouncement('Duplicated', name))
    },
    [library, reload, dispatch, failed, announce],
  )

  const confirmDelete = useCallback(async () => {
    const { id, name } = latestState.current.dialog
    const shownIds = latestState.current.list.projects.map((entry) => entry.id)
    const removed = await library.remove(id)
    if (!removed.ok) return failed(id, removed.problems)
    await reload()
    dispatch({ type: HOME_EVENT.deleted, focus: focusAfterRemove(shownIds, id) })
    announce(actionAnnouncement('Deleted', name))
  }, [library, reload, dispatch, failed, announce])

  const exportProject = useCallback(
    async (id) => {
      const exported = await library.exportFile(id)
      if (!exported.ok) return failed(id, exported.problems)
      downloadTextFile(exported.fileName, exported.text)
      announce(actionAnnouncement('Exported', exported.fileName))
    },
    [library, failed, announce],
  )

  return {
    state,
    setSort,
    openCreate,
    openRename,
    openDelete,
    cancelDialog,
    create,
    rename: (name) => runExclusive(() => rename(name)),
    duplicate: (id, name) => runExclusive(() => duplicate(id, name)),
    confirmDelete: () => runExclusive(confirmDelete),
    exportProject: (id) => runExclusive(() => exportProject(id)),
  }
}
