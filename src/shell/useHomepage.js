import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HOME_EVENT,
  INITIAL_HOME_STATE,
  FOCUS,
  actionAnnouncement,
  describeHomeImport,
  focusAfterRemove,
  reduceHome,
} from '../flow/homeFlow.js'
import { projectHref } from '../flow/homepageView.js'
import { importNotices } from '../flow/importFlow.js'
import { toRejection } from '../flow/problemsView.js'
import { notSavedAnnouncement } from '../flow/storeStatus.js'
import { report } from './diagnostics.js'
import { downloadTextFile } from './download.js'
import { STORE_STATUS, useStore } from './StoreProvider.jsx'
import { readImport, useImportFlow } from './useImportFlow.js'

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
  // A refused card action: its problems show under "Storage problems" and focus returns to it.
  const failed = useCallback(
    (id, problems) => dispatch({ type: HOME_EVENT.actionFailed, id, problems }),
    [dispatch],
  )
  // A refused write from a card (duplicate, delete) also says it was not saved.
  const notSaved = useCallback(
    (id, problems) => {
      announce(notSavedAnnouncement(problems))
      failed(id, problems)
    },
    [announce, failed],
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

  // A refused rename, of the name, the stored file or the write, keeps the dialog open with the
  // problems, as create does.
  const rename = useCallback(
    async (name) => {
      const { id } = latestState.current.dialog
      const renamed = await library.rename(id, name)
      if (!renamed.ok) {
        dispatch({ type: HOME_EVENT.nameRefused, id, problems: renamed.problems })
        return
      }
      await reload()
      dispatch({ type: HOME_EVENT.renamed, id })
    },
    [library, reload, dispatch],
  )

  const duplicate = useCallback(
    async (id, name) => {
      const copied = await library.duplicate(id)
      if (!copied.ok) return notSaved(id, copied.problems)
      await reload()
      dispatch({ type: HOME_EVENT.duplicated, id, copyId: copied.project.project.id })
      announce(actionAnnouncement('Duplicated', name))
    },
    [library, reload, dispatch, notSaved, announce],
  )

  const confirmDelete = useCallback(async () => {
    const { id, name } = latestState.current.dialog
    const shownIds = latestState.current.list.projects.map((entry) => entry.id)
    const removed = await library.remove(id)
    if (!removed.ok) return notSaved(id, removed.problems)
    await reload()
    dispatch({ type: HOME_EVENT.deleted, id, focus: focusAfterRemove(shownIds, id) })
    announce(actionAnnouncement('Deleted', name))
  }, [library, reload, dispatch, notSaved, announce])

  const exportProject = useCallback(
    async (id) => {
      const exported = await library.exportFile(id)
      if (!exported.ok) return failed(id, exported.problems)
      downloadTextFile(exported.fileName, exported.text)
      dispatch({ type: HOME_EVENT.actionSucceeded })
      announce(actionAnnouncement('Exported', exported.fileName))
    },
    [library, failed, dispatch, announce],
  )

  // A card's "Replace from file": the shared import flow, with the card as the project it replaces.
  // The file's map is saved under the card's id, which also repairs a card that cannot be opened.
  const replaceTarget = useRef(null)
  const replaceFocusRef = useRef(null)
  const getReplaceTarget = useCallback(() => replaceTarget.current, [])
  const saveReplacement = useCallback(
    async (replacement) => {
      const { id } = replacement.project
      const saved = await library.save(replacement)
      if (!saved.ok) {
        announce(notSavedAnnouncement(saved.problems))
        failed(id, saved.problems)
        return false
      }
      await reload()
      dispatch({ type: HOME_EVENT.actionSucceeded })
      return true
    },
    [library, announce, failed, reload, dispatch],
  )
  const replaceFlow = useImportFlow({
    getCurrentProject: getReplaceTarget,
    onReplace: saveReplacement,
    announce,
    returnFocusRef: replaceFocusRef,
  })
  // Called as the card's menu hands focus back to its button, so focus returns there afterwards.
  const chooseReplaceTarget = useCallback((id, name) => {
    replaceTarget.current = { id, name }
    replaceFocusRef.current = document.activeElement
  }, [])

  // A file chosen for a card replaces the homepage import's outcome line, and the reverse.
  const { resetImport } = replaceFlow
  const replaceFromFile = useCallback(
    (file) => {
      dispatch({ type: HOME_EVENT.importDismissed })
      return replaceFlow.importFile(file)
    },
    [dispatch, replaceFlow],
  )

  // "Import project": a new project, no confirmation, under the file's id unless it is taken. Not
  // one at a time: two imports both land, the library picks their ids in turn.
  const importNew = useCallback(
    async (file) => {
      const result = await readImport(file)
      if (!result.ok) {
        result.problems.forEach(report)
        announce(toRejection('Import', result.problems).announcement)
        resetImport()
        dispatch({ type: HOME_EVENT.importRejected, problems: result.problems })
        return
      }
      const imported = await library.importNew(result.file)
      if (!imported.ok) {
        announce(notSavedAnnouncement(imported.problems))
        resetImport()
        dispatch({ type: HOME_EVENT.importDismissed })
        dispatch({
          type: HOME_EVENT.actionFailed,
          id: null,
          problems: imported.problems,
          focus: { target: FOCUS.importProject },
        })
        return
      }
      await reload()
      const text = describeHomeImport({
        name: imported.project.project.name,
        stepCount: imported.project.nodes.length,
        isNewId: imported.isNewId,
        notices: importNotices(result),
      })
      resetImport()
      dispatch({ type: HOME_EVENT.imported, id: imported.project.project.id, text })
      announce(text)
    },
    [library, reload, dispatch, announce, resetImport],
  )
  const dismissImport = useCallback(
    () => dispatch({ type: HOME_EVENT.importDismissed, focus: { target: FOCUS.importProject } }),
    [dispatch],
  )

  return {
    state,
    isStoreReady: status === STORE_STATUS.ready,
    importNew,
    dismissImport,
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
    replace: { ...replaceFlow, importFile: replaceFromFile, chooseTarget: chooseReplaceTarget },
  }
}
