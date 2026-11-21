import { describe, expect, it } from 'vitest'
import { problem } from './diagnostics/problem.js'
import { contentHash } from './contentHash.js'
import { parseImport } from './importFile.js'
import { layoutSteps, STEP_CARD_HEIGHT, STEP_CARD_WIDTH } from './layout.js'
import { toProjectFile, withContentHash } from './projectFile.js'
import {
  EMPTY_SESSION,
  applyToSession,
  checkCanSwitch,
  discard,
  hasUnsavedChanges,
  markSaved,
  openSession,
  toSaveFile,
} from './session.js'

const NOW = new Date('2026-11-21T10:30:00.000Z')
const TOOL = 'aie-mcp'

const makeNewId = () => {
  let count = 0
  return () => {
    count += 1
    return `new-${count}`
  }
}

const deps = () => ({ newId: makeNewId() })

const step = (id, label, x, y, data = {}) => ({
  id,
  type: 'step',
  position: { x, y },
  data: { label, ...data },
})

// A file the app exported: steps dragged to where a person left them, a valid hash, no mark.
const appExport = async (overrides = {}) =>
  withContentHash(
    toProjectFile({
      project: { id: 'p1', name: 'Checkout' },
      nodes: [
        step('a', 'Plan', 300, 40, { pt: 5, queue: 2 }),
        step('b', 'Build', 20, 90, { pt: 30, lt: 60, ca: 90, queue: 4, batch: 1 }),
        step('c', 'Ship', 500, 500, { queue: 0 }),
      ],
      edges: [
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'b->c', source: 'b', target: 'c' },
      ],
      now: new Date('2026-11-14T12:00:00.000Z'),
      ...overrides,
    }),
  )

const opened = async (file, name = 'team.json') => {
  const result = await openSession(JSON.stringify(file ?? (await appExport())), name)
  expect(result.ok).toBe(true)
  return result.session
}

const setQueue = (session, stepId, queue) =>
  applyToSession(session, { name: 'set_step_metrics', args: { stepId, queue } }, deps())

// An open project that has one applied change.
const changed = async () => {
  const result = setQueue(await opened(), 'a', 8)
  expect(result.ok).toBe(true)
  return result.session
}

describe('EMPTY_SESSION', () => {
  it('holds no project, no file name and no changes', () => {
    expect(EMPTY_SESSION).toEqual({ name: null, project: null, baseline: null, changes: 0 })
    expect(hasUnsavedChanges(EMPTY_SESSION)).toBe(false)
  })
})

describe('openSession', () => {
  it('opens a valid file as a clean session holding the project and the file name', async () => {
    const file = await appExport()
    const result = await openSession(JSON.stringify(file), 'team.json')
    expect(result).toEqual({
      ok: true,
      session: {
        name: 'team.json',
        project: { project: file.project, nodes: file.nodes, edges: file.edges },
        baseline: { project: file.project, nodes: file.nodes, edges: file.edges },
        changes: 0,
      },
    })
    expect(hasUnsavedChanges(result.session)).toBe(false)
  })

  it('upgrades a 0.0.0 file on open', async () => {
    const old = { ...(await appExport()), schemaVersion: '0.0.0' }
    const result = await openSession(JSON.stringify(old), 'old.json')
    expect(result.ok).toBe(true)
    expect(result.session.project.nodes).toHaveLength(3)
  })

  it.each([
    ['text that is not JSON', 'not json at all', 'FILE_NOT_JSON'],
    [
      'a file with a negative pt',
      JSON.stringify({
        schemaVersion: '0.1.0',
        project: { id: 'p', name: 'P' },
        nodes: [step('a', 'A', 0, 0, { pt: -1 })],
        edges: [],
      }),
      'STEP_COUNT_INVALID',
    ],
  ])('fails on %s with its problem and no session', async (_label, text, code) => {
    const result = await openSession(text, 'bad.json')
    expect(result.ok).toBe(false)
    expect(result.problems.map((found) => found.code)).toEqual([code])
    expect(result).not.toHaveProperty('session')
  })
})

describe('applyToSession', () => {
  it('applies a command, keeps the file name and counts one unsaved change', async () => {
    const session = await opened()
    const result = setQueue(session, 'a', 8)
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([])
    expect(result.summary).toBe('Set queue=8 on step "Plan" (a)')
    expect(result.session.name).toBe('team.json')
    expect(result.session.project.nodes[0].data.queue).toBe(8)
    expect(result.session.changes).toBe(1)
    expect(hasUnsavedChanges(result.session)).toBe(true)
    expect(session.project.nodes[0].data.queue).toBe(2)
  })

  it('does not move any existing step', async () => {
    const session = await opened()
    const result = applyToSession(session, { name: 'add_step', args: { name: 'Test' } }, deps())
    const positions = (value) => value.project.nodes.slice(0, 3).map((node) => node.position)
    expect(positions(result.session)).toEqual(positions(session))
    expect(result.created).toBe('new-1')
  })

  it('leaves a session clean and unchanged when the command is rejected', async () => {
    const session = await opened()
    const result = setQueue(session, 'a', -5)
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
    expect(result.summary).toMatch(/^Rejected set_step_metrics: nothing changed/)
    expect(result.session).toBe(session)
    expect(checkCanSwitch(result.session)).toEqual([])
  })

  it.each([null, undefined])('rejects the missing command %s without throwing', async (command) => {
    const session = await opened()
    const result = applyToSession(session, command, deps())
    expect(result.ok).toBe(false)
    expect(result.problems.map((found) => found.code)).toEqual(['CMD_UNKNOWN'])
    expect(result.session).toBe(session)
  })

  it('does not return the project on its own, only inside the session', async () => {
    expect(setQueue(await opened(), 'a', 8)).not.toHaveProperty('project')
  })

  it('rejects a command with no open project', () => {
    const result = applyToSession(EMPTY_SESSION, { name: 'add_step', args: { name: 'A' } }, deps())
    expect(result.ok).toBe(false)
    expect(result.problems.map((found) => found.code)).toEqual(['CMD_NO_PROJECT'])
    expect(result.session).toBe(EMPTY_SESSION)
  })

  it('creates a project in an empty session as an unsaved project with no file name', () => {
    const result = applyToSession(
      EMPTY_SESSION,
      { name: 'create_project', args: { name: 'Fresh' } },
      deps(),
    )
    expect(result.ok).toBe(true)
    expect(result.session).toEqual({
      name: null,
      project: { project: { id: 'new-1', name: 'Fresh' }, nodes: [], edges: [] },
      baseline: null,
      changes: 1,
    })
    expect(hasUnsavedChanges(result.session)).toBe(true)
  })

  it('creates a project over a clean open project', async () => {
    const result = applyToSession(
      await opened(),
      { name: 'create_project', args: { name: 'Fresh' } },
      deps(),
    )
    expect(result.ok).toBe(true)
    expect(result.session.project.project.name).toBe('Fresh')
    expect(result.session.name).toBeNull()
  })

  it('blocks create_project while there are unsaved changes and keeps the first project', async () => {
    const session = await changed()
    const result = applyToSession(
      session,
      { name: 'create_project', args: { name: 'Fresh' } },
      deps(),
    )
    expect(result.ok).toBe(false)
    expect(result.problems).toEqual([problem('CMD_UNSAVED_CHANGES')])
    expect(result.summary).toBe('Rejected create_project: the open project has unsaved changes')
    expect(result.session).toBe(session)
  })

  it('lets other commands run while there are unsaved changes', async () => {
    const result = setQueue(await changed(), 'b', 9)
    expect(result.ok).toBe(true)
    expect(result.session.changes).toBe(2)
  })
})

describe('checkCanSwitch', () => {
  it('allows switching when nothing is open or nothing is unsaved', async () => {
    expect(checkCanSwitch(EMPTY_SESSION)).toEqual([])
    expect(checkCanSwitch(await opened())).toEqual([])
  })

  it('blocks opening another file while there are unsaved changes, naming save_project then discard_changes', async () => {
    const problems = checkCanSwitch(await changed())
    expect(problems).toEqual([problem('CMD_UNSAVED_CHANGES')])
    const { message, fix } = problems[0]
    expect(message).toMatch(/unsaved changes/)
    expect(message.indexOf('save_project')).toBeGreaterThan(-1)
    expect(message.indexOf('save_project')).toBeLessThan(message.indexOf('discard_changes'))
    expect(fix.indexOf('save_project')).toBeLessThan(fix.indexOf('discard_changes'))
  })
})

describe('discard', () => {
  it('drops the changes, restores the project as opened and allows switching', async () => {
    const session = await changed()
    const result = discard(session)
    expect(result.discarded).toBe(1)
    expect(result.session.project).toBe(session.baseline)
    expect(result.session.project.nodes[0].data.queue).toBe(2)
    expect(result.session.name).toBe('team.json')
    expect(checkCanSwitch(result.session)).toEqual([])
  })

  it('counts every discarded change', async () => {
    const twice = setQueue(await changed(), 'b', 9).session
    expect(discard(twice).discarded).toBe(2)
  })

  it('closes a created project that was never saved', () => {
    const created = applyToSession(
      EMPTY_SESSION,
      { name: 'create_project', args: { name: 'Fresh' } },
      deps(),
    ).session
    expect(discard(created)).toEqual({ session: EMPTY_SESSION, discarded: 1 })
  })

  it('does nothing to a clean session', async () => {
    const session = await opened()
    expect(discard(session)).toEqual({ session, discarded: 0 })
  })
})

describe('toSaveFile', () => {
  it('saves the project as 0.1.0 with the export time, the mark and a valid hash', async () => {
    const original = await appExport()
    const session = setQueue(await opened(original), 'a', 8).session
    const saved = await toSaveFile(session, { now: NOW, tool: TOOL })
    expect(saved.ok).toBe(true)
    const { file } = saved
    expect(file.schemaVersion).toBe('0.1.0')
    expect(file.exportedAt).toBe('2026-11-21T10:30:00.000Z')
    expect(file.modifiedBy).toEqual({ tool: 'aie-mcp', at: '2026-11-21T10:30:00.000Z' })
    expect(file.contentHash).toBe(await contentHash(file))
    expect(file.nodes[0].data.queue).toBe(8)
  })

  it('matches the original in every other field', async () => {
    const original = await appExport()
    const session = setQueue(await opened(original), 'a', 8).session
    const { file } = await toSaveFile(session, { now: NOW, tool: TOOL })
    const laidOut = layoutSteps(original.nodes, original.edges)
    const expected = {
      ...original,
      schemaVersion: '0.1.0',
      exportedAt: NOW.toISOString(),
      modifiedBy: { tool: TOOL, at: NOW.toISOString() },
      nodes: laidOut.map((node) =>
        node.id === 'a' ? { ...node, data: { ...node.data, queue: 8 } } : node,
      ),
      contentHash: file.contentHash,
    }
    expect(file).toEqual(expected)
  })

  it('writes a file the app imports as unedited and marked as changed by the tool', async () => {
    const session = setQueue(await opened(), 'a', 8).session
    const { file } = await toSaveFile(session, { now: NOW, tool: TOOL })
    const imported = await parseImport(JSON.stringify(file))
    expect(imported).toEqual({
      ok: true,
      file,
      edited: false,
      changedBy: { tool: TOOL, at: NOW.toISOString() },
    })
  })

  it('covers the mark with the hash, so changing the tool changes the hash', async () => {
    const session = await opened()
    const first = await toSaveFile(session, { now: NOW, tool: 'one' })
    const second = await toSaveFile(session, { now: NOW, tool: 'two' })
    expect(first.file.contentHash).not.toBe(second.file.contentHash)
  })

  it('opens a 0.0.0 file and saves it as 0.1.0', async () => {
    const old = { ...(await appExport()), schemaVersion: '0.0.0' }
    const session = await opened(old, 'old.json')
    const { file } = await toSaveFile(session, { now: NOW, tool: TOOL })
    expect(file.schemaVersion).toBe('0.1.0')
    expect((await parseImport(JSON.stringify(file))).ok).toBe(true)
  })

  it('lays the map out on save so every connection points left to right without overlaps', async () => {
    const session = await opened()
    const added = applyToSession(session, { name: 'add_step', args: { name: 'Test' } }, deps())
    const { file } = await toSaveFile(added.session, { now: NOW, tool: TOOL })
    const at = (id) => file.nodes.find((node) => node.id === id).position
    file.edges.forEach((edge) => {
      expect(at(edge.source).x).toBeLessThan(at(edge.target).x)
    })
    const overlap = (p, q) =>
      Math.abs(p.x - q.x) < STEP_CARD_WIDTH && Math.abs(p.y - q.y) < STEP_CARD_HEIGHT
    file.nodes.forEach((first, i) =>
      file.nodes.slice(i + 1).forEach((second) => {
        expect(overlap(first.position, second.position)).toBe(false)
      }),
    )
    const project = added.session.project
    expect(file.nodes.map((node) => node.position)).toEqual(
      layoutSteps(project.nodes, project.edges).map((node) => node.position),
    )
  })

  it('does not lay out the in-memory project', async () => {
    const session = await opened()
    await toSaveFile(session, { now: NOW, tool: TOOL })
    expect(session.project.nodes[0].position).toEqual({ x: 300, y: 40 })
  })

  it('fails with no open project, naming open_project and create_project', async () => {
    const result = await toSaveFile(EMPTY_SESSION, { now: NOW, tool: TOOL })
    expect(result).toEqual({ ok: false, problems: [problem('CMD_PROJECT_NOT_OPEN')] })
    const { message } = result.problems[0]
    expect(message).toMatch(/open_project/)
    expect(message).toMatch(/create_project/)
  })
})

describe('markSaved', () => {
  it('clears the unsaved changes, takes the laid-out file as the project and allows switching', async () => {
    const session = await changed()
    const { file } = await toSaveFile(session, { now: NOW, tool: TOOL })
    const saved = markSaved(session, file)
    expect(saved.changes).toBe(0)
    expect(saved.name).toBe('team.json')
    expect(saved.project).toEqual({ project: file.project, nodes: file.nodes, edges: file.edges })
    expect(saved.baseline).toBe(saved.project)
    expect(checkCanSwitch(saved)).toEqual([])
    expect(discard(saved).session).toBe(saved)
  })

  it('names a created project after the file it was saved as', async () => {
    const created = applyToSession(
      EMPTY_SESSION,
      { name: 'create_project', args: { name: 'Fresh' } },
      deps(),
    ).session
    const { file } = await toSaveFile(created, { now: NOW, tool: TOOL })
    expect(markSaved(created, file, 'first.json').name).toBe('first.json')
  })

  it('leaves a session with unsaved changes alone when nothing marks it saved', async () => {
    const session = await changed()
    await toSaveFile(session, { now: NOW, tool: TOOL })
    expect(hasUnsavedChanges(session)).toBe(true)
  })
})
