import { describe, expect, it } from 'vitest'
import {
  EDITED_NOTICE,
  IMPORT_EVENT,
  INITIAL_IMPORT_STATE,
  describeImportStatus,
  fromProjectFile,
  reduceImport,
} from './importFlow.js'
import { CURRENT_SCHEMA_VERSION } from './schema/version.js'

const OPEN_PROJECT = { id: 'open-id', name: 'Untitled Project' }
const NOT_JSON = 'This file is not valid JSON.'

const step = (id, label) => ({
  id,
  type: 'step',
  position: { x: 10, y: 20 },
  data: { label, pt: 5 },
})

const projectFile = (project, nodes = [step('a', 'Plan'), step('b', 'Build')]) => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  exportedAt: '2026-11-14T12:00:00.000Z',
  project,
  nodes,
  edges: [{ id: 'a->b', source: 'a', target: 'b' }],
})

const parsed = (file, edited = false) => ({
  type: IMPORT_EVENT.fileParsed,
  result: { ok: true, file, edited },
  project: OPEN_PROJECT,
})
const failed = (message) => ({
  type: IMPORT_EVENT.fileParsed,
  result: { ok: false, message },
  project: OPEN_PROJECT,
})

// Runs events in order and returns the last transition, { state, announcement, replacement }.
const reduceAll = (events, state = INITIAL_IMPORT_STATE) =>
  events.reduce((last, event) => reduceImport(last.state, event), { state })

const confirmFor = (file) => reduceImport(INITIAL_IMPORT_STATE, parsed(file))

describe('reduceImport confirmation', () => {
  it('asks the same-name question and keeps the open id', () => {
    const file = projectFile({ id: 'file-id', name: 'Untitled Project' })
    const { state, announcement, replacement } = confirmFor(file)

    expect(state).toMatchObject({
      type: 'confirming',
      message: 'Replace current map with the imported version of Untitled Project?',
      currentName: 'Untitled Project',
      incomingName: 'Untitled Project',
      project: { id: 'open-id', name: 'Untitled Project' },
    })
    expect(announcement).toBeNull()
    expect(replacement).toBeNull()
  })

  it('asks the different-name question and takes the file name, even with the same id', () => {
    const file = projectFile({ id: 'open-id', name: 'Checkout Revamp' })
    const { state } = confirmFor(file)

    expect(state).toMatchObject({
      type: 'confirming',
      message: 'Replace current map with Checkout Revamp?',
      currentName: 'Untitled Project',
      incomingName: 'Checkout Revamp',
      project: { id: 'open-id', name: 'Checkout Revamp' },
    })
  })

  it('takes a different file id when the name differs', () => {
    const { state } = confirmFor(projectFile({ id: 'abc', name: 'Checkout Revamp' }))
    expect(state.project).toEqual({ id: 'abc', name: 'Checkout Revamp' })
  })

  it.each([
    ['a different case', 'untitled project'],
    ['a trailing space', 'Untitled Project '],
    ['a leading space', ' Untitled Project'],
  ])('treats %s as a different name', (_label, name) => {
    const { state } = confirmFor(projectFile({ id: 'open-id', name }))
    expect(state.message).toBe(`Replace current map with ${name}?`)
    expect(state.project).toEqual({ id: 'open-id', name })
  })
})

describe('reduceImport outcomes', () => {
  const sameNameFile = projectFile({ id: 'file-id', name: 'Untitled Project' })

  it('replaces the map on confirm, keeping the open id for a same-name file', () => {
    const { state, announcement, replacement } = reduceAll([
      parsed(sameNameFile),
      { type: IMPORT_EVENT.confirm },
    ])

    expect(replacement).toEqual({
      project: { id: 'open-id', name: 'Untitled Project' },
      ...fromProjectFile(sameNameFile),
    })
    expect(announcement).toBe('Imported Untitled Project, 2 steps')
    expect(state).toEqual({ type: 'idle', status: 'Imported Untitled Project, 2 steps' })
  })

  it('replaces the project name and id on confirm for a different-name file', () => {
    const file = projectFile({ id: 'abc', name: 'Checkout Revamp' })
    const { replacement } = reduceAll([parsed(file), { type: IMPORT_EVENT.confirm }])
    expect(replacement.project).toEqual({ id: 'abc', name: 'Checkout Revamp' })
  })

  it('says "1 step" for a single step', () => {
    const file = projectFile({ id: 'x', name: 'Solo' }, [step('a', 'Plan')])
    expect(reduceAll([parsed(file), { type: IMPORT_EVENT.confirm }]).announcement).toBe(
      'Imported Solo, 1 step',
    )
  })

  it('restores the earlier success status on cancel', () => {
    const afterSuccess = reduceAll([parsed(sameNameFile), { type: IMPORT_EVENT.confirm }]).state
    const { state } = reduceAll([parsed(sameNameFile), { type: IMPORT_EVENT.cancel }], afterSuccess)
    expect(state).toEqual({ type: 'idle', status: 'Imported Untitled Project, 2 steps' })
  })

  it('changes nothing on cancel and announces it', () => {
    const { state, announcement, replacement } = reduceAll([
      parsed(sameNameFile),
      { type: IMPORT_EVENT.cancel },
    ])

    expect(state).toEqual(INITIAL_IMPORT_STATE)
    expect(announcement).toBe('Import cancelled')
    expect(replacement).toBeNull()
  })

  it('shows and announces a parse error', () => {
    const { state, announcement, replacement } = reduceImport(
      INITIAL_IMPORT_STATE,
      failed(NOT_JSON),
    )

    expect(state).toEqual({ type: 'error', message: NOT_JSON })
    expect(announcement).toBe(NOT_JSON)
    expect(replacement).toBeNull()
  })

  it('drops the error when a later file parses', () => {
    const { state } = reduceAll([failed(NOT_JSON), parsed(sameNameFile)])
    expect(state.type).toBe('confirming')
  })

  it('clears an error after a later success', () => {
    const { state } = reduceAll([
      failed(NOT_JSON),
      parsed(sameNameFile),
      { type: IMPORT_EVENT.confirm },
    ])
    expect(state).toEqual({ type: 'idle', status: 'Imported Untitled Project, 2 steps' })
  })

  it('clears an error on dismiss without announcing', () => {
    const { state, announcement } = reduceAll([failed(NOT_JSON), { type: IMPORT_EVENT.dismiss }])
    expect(state).toEqual(INITIAL_IMPORT_STATE)
    expect(announcement).toBeNull()
  })

  it('replaces a prior success status when a new file fails', () => {
    const afterSuccess = reduceAll([parsed(sameNameFile), { type: IMPORT_EVENT.confirm }]).state
    expect(reduceImport(afterSuccess, failed(NOT_JSON)).state).toEqual({
      type: 'error',
      message: NOT_JSON,
    })
  })

  it.each([
    [IMPORT_EVENT.confirm, INITIAL_IMPORT_STATE],
    [IMPORT_EVENT.cancel, INITIAL_IMPORT_STATE],
    [IMPORT_EVENT.dismiss, { type: 'idle', status: 'Imported A, 1 step' }],
    [IMPORT_EVENT.confirm, { type: 'error', message: NOT_JSON }],
    [IMPORT_EVENT.cancel, { type: 'error', message: NOT_JSON }],
  ])('ignores %s in a state that cannot take it', (type, state) => {
    expect(reduceImport(state, { type })).toEqual({ state, announcement: null, replacement: null })
  })

  it('ignores dismiss while confirming', () => {
    const confirming = confirmFor(sameNameFile).state
    expect(reduceImport(confirming, { type: IMPORT_EVENT.dismiss }).state).toBe(confirming)
  })
})

describe('reduceImport with an edited file', () => {
  const file = projectFile({ id: 'file-id', name: 'Untitled Project' })
  const EDITED_OUTCOME = `Imported Untitled Project, 2 steps. ${EDITED_NOTICE}`

  it('states the notice text that the dialog and the outcome share', () => {
    expect(EDITED_NOTICE).toBe('This file was changed outside AI Enabler after it was exported.')
  })

  it.each([
    ['an edited file', true],
    ['an untouched file', false],
  ])('carries the flag of %s into the confirmation', (_name, edited) => {
    expect(reduceImport(INITIAL_IMPORT_STATE, parsed(file, edited)).state.isEdited).toBe(edited)
  })

  it('adds the notice to the outcome announcement and the status line', () => {
    const { state, announcement } = reduceAll([parsed(file, true), { type: IMPORT_EVENT.confirm }])
    expect(announcement).toBe(EDITED_OUTCOME)
    expect(describeImportStatus(state)).toEqual({ text: EDITED_OUTCOME, isError: false })
  })

  it('still replaces the map on confirm', () => {
    const { replacement } = reduceAll([parsed(file, true), { type: IMPORT_EVENT.confirm }])
    expect(replacement).toEqual({
      project: { id: 'open-id', name: 'Untitled Project' },
      ...fromProjectFile(file),
    })
  })

  it('leaves the outcome announcement of an untouched file without the notice', () => {
    const { announcement } = reduceAll([parsed(file, false), { type: IMPORT_EVENT.confirm }])
    expect(announcement).toBe('Imported Untitled Project, 2 steps')
  })

  it('cancels as before and announces nothing about the edit', () => {
    const { state, announcement } = reduceAll([parsed(file, true), { type: IMPORT_EVENT.cancel }])
    expect(state).toEqual(INITIAL_IMPORT_STATE)
    expect(announcement).toBe('Import cancelled')
  })
})

describe('fromProjectFile', () => {
  it('keeps only allowlisted node and edge fields', () => {
    const file = projectFile({ id: 'p', name: 'P' }, [
      {
        id: 'a',
        type: 'step',
        position: { x: 1, y: 2, z: 3 },
        data: { label: 'Plan', pt: 5, lt: 9, ca: 80, queue: 2, batch: 3, onClick: 'x' },
        style: { display: 'none' },
        className: 'evil',
        hidden: true,
        selected: true,
      },
    ])
    file.edges = [{ id: 'e', source: 'a', target: 'a', animated: true, style: { stroke: 'red' } }]

    expect(fromProjectFile(file)).toEqual({
      nodes: [
        {
          id: 'a',
          type: 'step',
          position: { x: 1, y: 2 },
          data: { label: 'Plan', pt: 5, lt: 9, ca: 80, queue: 2, batch: 3 },
          ariaLabel: 'Plan',
        },
      ],
      edges: [{ id: 'e', source: 'a', target: 'a' }],
    })
  })

  it('defaults an absent node type to step and leaves absent optional fields out', () => {
    const file = projectFile({ id: 'p', name: 'P' }, [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Plan' } },
    ])
    expect(fromProjectFile(file).nodes).toEqual([
      {
        id: 'a',
        type: 'step',
        position: { x: 0, y: 0 },
        data: { label: 'Plan' },
        ariaLabel: 'Plan',
      },
    ])
  })
})

describe('describeImportStatus', () => {
  it('shows nothing before any import', () => {
    expect(describeImportStatus(INITIAL_IMPORT_STATE)).toBeNull()
  })

  it('shows the error message as an error', () => {
    expect(describeImportStatus(reduceAll([failed(NOT_JSON)]).state)).toEqual({
      text: NOT_JSON,
      isError: true,
    })
  })

  it('shows the last outcome after a replace, as a non-error', () => {
    const file = projectFile({ id: 'file-id', name: 'Checkout Revamp' })
    const { state } = reduceAll([parsed(file), { type: IMPORT_EVENT.confirm }])
    expect(describeImportStatus(state)).toEqual({
      text: 'Imported Checkout Revamp, 2 steps',
      isError: false,
    })
  })

  it('shows nothing while a confirmation is pending', () => {
    const file = projectFile({ id: 'file-id', name: 'Checkout Revamp' })
    expect(describeImportStatus(reduceAll([parsed(file)]).state)).toBeNull()
  })

  it('shows nothing after a cancel when nothing was imported before', () => {
    const file = projectFile({ id: 'file-id', name: 'Checkout Revamp' })
    expect(
      describeImportStatus(reduceAll([parsed(file), { type: IMPORT_EVENT.cancel }]).state),
    ).toBeNull()
  })

  it('keeps the earlier success line after a cancel', () => {
    const file = projectFile({ id: 'file-id', name: 'Checkout Revamp' })
    const { state } = reduceAll([
      parsed(file),
      { type: IMPORT_EVENT.confirm },
      parsed(file),
      { type: IMPORT_EVENT.cancel },
    ])
    expect(describeImportStatus(state)).toEqual({
      text: 'Imported Checkout Revamp, 2 steps',
      isError: false,
    })
  })
})
