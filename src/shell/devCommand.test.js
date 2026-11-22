import { describe, expect, test } from 'vitest'
import { DEV_COMMAND_EVENT, DEV_COMMAND_READY_ATTRIBUTE, parseDevCommand } from './devCommand.js'

describe('parseDevCommand', () => {
  test('returns the commands of a valid list, each as name and args', () => {
    const detail = {
      commands: [
        { name: 'remove_step', args: { id: 'a' } },
        { name: 'add_step', args: { name: 'X' }, extra: true },
      ],
    }

    expect(parseDevCommand(detail)).toEqual([
      { name: 'remove_step', args: { id: 'a' } },
      { name: 'add_step', args: { name: 'X' } },
    ])
  })

  test('passes a name the command layer does not know', () => {
    expect(parseDevCommand({ commands: [{ name: 'no_such_command' }] })).toEqual([
      { name: 'no_such_command', args: undefined },
    ])
  })

  test.each([
    ['an empty list', { commands: [] }],
    ['no list', {}],
    ['a list that is not an array', { commands: 'remove_step' }],
    ['no detail', undefined],
    ['a null detail', null],
    ['an entry that is not an object', { commands: [{ name: 'remove_step' }, 'remove_step'] }],
    ['a null entry', { commands: [null] }],
    ['an array entry', { commands: [['remove_step']] }],
    ['create_project', { commands: [{ name: 'create_project', args: { name: 'X' } }] }],
    [
      'create_project after a valid command',
      { commands: [{ name: 'remove_step', args: {} }, { name: 'create_project' }] },
    ],
  ])('returns null for %s', (_label, detail) => {
    expect(parseDevCommand(detail)).toBeNull()
  })

  test('names the event and the ready attribute', () => {
    expect(DEV_COMMAND_EVENT).toBe('aie-dev-command')
    expect(DEV_COMMAND_READY_ATTRIBUTE).toBe('data-aie-dev-command-ready')
  })
})
