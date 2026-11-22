import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index.js'
import { validateProjectFile } from '../schema/validate.js'
import { STEP_DATA_FIELDS } from '../step.js'
import { problem } from './problem.js'
import {
  KNOWN_FIELDS,
  RECORD_KEYS,
  parseRecord,
  serializeRecord,
  toErrorRecord,
  toRecord,
} from './record.js'

const MARKER = 'SECRET-MARKER'
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const context = {
  version: '0.1.0',
  session: 'session-1',
  platform: 'browser',
  build: 'dev',
  time: new Date(Date.UTC(2026, 10, 22, 1, 2, 3, 4)).toISOString(),
}

describe('toRecord', () => {
  it('builds a record with exactly the allow-listed keys, in order', () => {
    const record = toRecord(problem('FILE_NOT_JSON'), context)
    expect(Object.keys(record)).toEqual(RECORD_KEYS)
    expect(record).toEqual({
      source: 'aie',
      code: 'FILE_NOT_JSON',
      severity: 'error',
      ...context,
    })
    expect(record.time).toMatch(ISO_UTC)
  })

  it('copies the catalog severity, not one the caller supplies', () => {
    const record = toRecord({ ...problem('FILE_NOT_JSON'), severity: 'hint' }, context)
    expect(record.severity).toBe('hint')
  })

  it('keeps no context key beyond the five it names', () => {
    const record = toRecord(problem('FILE_NOT_JSON'), { ...context, cwd: MARKER })
    expect(Object.keys(record)).toEqual(RECORD_KEYS)
  })

  it('never carries user or map text, whatever key it sits under', () => {
    const noisy = {
      ...problem('FILE_NOT_JSON'),
      message: MARKER,
      params: { step: MARKER },
      untrusted: { title: MARKER },
      stepId: MARKER,
      edgeId: MARKER,
      field: MARKER,
      detail: MARKER,
    }
    const record = toRecord(noisy, context)
    expect(Object.keys(record)).toEqual(RECORD_KEYS)
    expect(serializeRecord(record)).not.toContain(MARKER)
  })

  it('keeps a known field name and drops an unknown one', () => {
    const known = toRecord(problem('FILE_PROJECT_NAME_EMPTY', { field: 'project.name' }), context)
    const unknown = toRecord({ ...problem('FILE_NOT_JSON'), field: MARKER }, context)
    expect(known.field).toBe('project.name')
    expect(unknown).not.toHaveProperty('field')
  })

  it('carries suppressed only when above zero', () => {
    const counted = toRecord(problem('FILE_NOT_JSON'), context, 2)
    const none = toRecord(problem('FILE_NOT_JSON'), context, 0)
    const omitted = toRecord(problem('FILE_NOT_JSON'), context)
    expect(counted.suppressed).toBe(2)
    expect(none).not.toHaveProperty('suppressed')
    expect(omitted).not.toHaveProperty('suppressed')
  })
})

describe('serializeRecord', () => {
  it('returns one line of JSON that parses back to the record', () => {
    const record = toRecord(problem('FILE_NOT_JSON'), { ...context, session: 'a\nb' }, 1)
    const line = serializeRecord(record)
    expect(line).not.toMatch(/[\r\n]/)
    expect(JSON.parse(line)).toEqual(record)
  })
})

describe('parseRecord', () => {
  it('parses a serialised record back to the same record', () => {
    const record = toRecord(
      problem('FILE_PROJECT_NAME_EMPTY', { field: 'project.name' }),
      context,
      2,
    )
    expect(parseRecord(serializeRecord(record))).toEqual(record)
  })

  it('parses a serialised error record back to the same record', () => {
    const record = toErrorRecord('APP_UNCAUGHT_ERROR', new Error('x'), context)
    expect(parseRecord(serializeRecord(record))).toEqual(record)
  })

  it.each([
    ['text that is not JSON', 'Warning: something broke'],
    ['an empty line', ''],
    ['a JSON array', '[{"source":"aie"}]'],
    ['JSON null', 'null'],
    ['a JSON string', '"aie"'],
    ['foreign JSON', '{"source":"other","code":"X"}'],
    ['JSON with no source', '{"code":"FILE_NOT_JSON"}'],
  ])('returns null for %s', (_label, text) => {
    expect(parseRecord(text)).toBeNull()
  })
})

describe('KNOWN_FIELDS', () => {
  const step = (id, data) => ({ id, type: 'step', position: { x: 0, y: 0 }, data })
  const project = (overrides) => ({
    project: { id: 'p', name: 'Delivery' },
    nodes: [],
    edges: [],
    ...overrides,
  })

  // Inputs that make the validator set every fixed `field` it knows. The nine step problems and
  // the mark problems come from separate files because a bad mark and a bad project do not mix.
  const validatorInputs = [
    project({ project: { id: '', name: ' ' } }),
    project({
      nodes: [
        { type: 'other', data: {} },
        step('dup', { label: 'A', pt: -1, lt: 'x', queue: 1.5, batch: null, ca: 101 }),
        step('dup', { label: 'B' }),
        { id: 'no-label', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { source: 'dup', target: 'dup' },
        { id: 'e', source: 'dup', target: 'dup' },
        { id: 'e', source: 'dup', target: 'dup' },
      ],
    }),
    project({ modifiedBy: 'tool' }),
    project({ modifiedBy: {} }),
  ]

  // Commands rejected for a reason that sets `field`: a blank name, a step id that names no step
  // or is not text, and connection endpoints that are not text or name no step.
  const commandProject = project({
    nodes: [step('a', { label: 'A' }), step('b', { label: 'B' })],
  })
  const commandInputs = [
    { name: 'add_step', args: { name: ' ' } },
    { name: 'update_step', args: { stepId: 'a', name: '' } },
    { name: 'update_step', args: { stepId: 'missing', name: 'X' } },
    { name: 'set_step_metrics', args: { stepId: 7 } },
    { name: 'remove_step', args: { stepId: 'missing' } },
    { name: 'disconnect', args: { sourceId: 1, targetId: 2 } },
    { name: 'disconnect', args: { sourceId: 'missing', targetId: 'b' } },
    { name: 'disconnect', args: { sourceId: 'a', targetId: 'missing' } },
  ]

  const fieldsOf = (problems) => problems.map((found) => found.field).filter(Boolean)
  const collected = [
    ...validatorInputs.flatMap((file) => fieldsOf(validateProjectFile(file).problems)),
    ...commandInputs.flatMap((command) =>
      fieldsOf(applyCommand(commandProject, command, { newId: () => 'new' }).problems),
    ),
  ]

  it('sees the fixed fields the validator and the commands set', () => {
    // Guards against inputs that stop producing fields and make the drift check vacuous.
    expect(new Set(collected)).toEqual(
      new Set([
        ...STEP_DATA_FIELDS,
        'project.id',
        'project.name',
        'id',
        'position',
        'type',
        'modifiedBy',
        'modifiedBy.tool',
        'modifiedBy.at',
        'name',
        'stepId',
        'sourceId',
        'targetId',
      ]),
    )
  })

  it('contains every field the validator and the commands set', () => {
    const missing = [...new Set(collected)].filter((field) => !KNOWN_FIELDS.includes(field))
    expect(missing).toEqual([])
  })
})

describe('toErrorRecord', () => {
  const crash = (build) => ({ ...context, build })
  const withMarker = () => new TypeError(`${MARKER} is not a function`)

  it('keeps only the error name for a prod build, with no marker anywhere', () => {
    const record = toErrorRecord('APP_UNCAUGHT_ERROR', withMarker(), crash('prod'))
    expect(record.error).toEqual({ name: 'TypeError' })
    expect(serializeRecord(record)).not.toContain(MARKER)
  })

  it('keeps the name, message and stack for a dev build', () => {
    const error = withMarker()
    const record = toErrorRecord('APP_UNCAUGHT_ERROR', error, crash('dev'))
    expect(record.error).toEqual({ name: 'TypeError', message: error.message, stack: error.stack })
  })

  it('treats a build other than dev as prod', () => {
    const record = toErrorRecord('APP_UNCAUGHT_ERROR', withMarker(), crash('staging'))
    expect(record.error).toEqual({ name: 'TypeError' })
  })

  it('names a thrown string NonError and keeps its text out, in dev and prod', () => {
    const dev = toErrorRecord('APP_UNHANDLED_REJECTION', MARKER, crash('dev'))
    const prod = toErrorRecord('APP_UNHANDLED_REJECTION', MARKER, crash('prod'))
    expect(dev.error).toEqual({ name: 'NonError' })
    expect(prod.error).toEqual({ name: 'NonError' })
    expect(serializeRecord(dev)).not.toContain(MARKER)
  })

  it('names a thrown null NonError', () => {
    expect(toErrorRecord('APP_UNHANDLED_REJECTION', null, crash('dev')).error).toEqual({
      name: 'NonError',
    })
  })

  it('has the base record keys, the catalog severity and the error, in one line', () => {
    const record = toErrorRecord('APP_RENDER_FAILED', new Error('x'), crash('prod'), 3)
    expect(Object.keys(record)).toEqual([...RECORD_KEYS, 'suppressed', 'error'])
    expect(record).toMatchObject({ source: 'aie', code: 'APP_RENDER_FAILED', severity: 'error' })
    expect(record.suppressed).toBe(3)
    expect(serializeRecord(record)).not.toMatch(/[\r\n]/)
  })

  it('throws on a code that is not in the catalog', () => {
    expect(() => toErrorRecord('APP_MADE_UP', new Error('x'), crash('dev'))).toThrow(
      'Unknown diagnostic code: APP_MADE_UP',
    )
  })
})
