import { describe, expect, test, vi } from 'vitest'
import { installGlobalHandlers } from './globalHandlers.js'

// A window stand-in: listeners are kept by event type and fired by hand.
const createFakeTarget = () => {
  const listeners = new Map()
  return {
    addEventListener: (type, listener) => listeners.set(type, listener),
    fire: (type, event) => listeners.get(type)(event),
  }
}

const installOnFakeTarget = (reportError) => {
  const target = createFakeTarget()
  installGlobalHandlers(target, reportError)
  return target
}

const createEvent = (fields) => ({ preventDefault: vi.fn(), ...fields })

describe('installGlobalHandlers', () => {
  test('reports an uncaught error with its Error', () => {
    const reportError = vi.fn()
    const target = installOnFakeTarget(reportError)
    const error = new Error('boom')

    target.fire('error', createEvent({ error }))

    expect(reportError.mock.calls).toEqual([['APP_UNCAUGHT_ERROR', error]])
  })

  test('reports an unhandled rejection with a string reason', () => {
    const reportError = vi.fn()
    const target = installOnFakeTarget(reportError)

    target.fire('unhandledrejection', createEvent({ reason: 'plain text' }))

    expect(reportError.mock.calls).toEqual([['APP_UNHANDLED_REJECTION', 'plain text']])
  })

  test.each([
    ['error', { error: new Error('boom') }],
    ['unhandledrejection', { reason: 'plain text' }],
  ])('calls preventDefault on %s', (type, fields) => {
    const target = installOnFakeTarget(vi.fn())
    const event = createEvent(fields)

    target.fire(type, event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  test('returns quietly when reportError throws, and calls it once', () => {
    const reportError = vi.fn(() => {
      throw new Error('sink is broken')
    })
    const target = installOnFakeTarget(reportError)
    const event = createEvent({ error: new Error('boom') })

    expect(() => target.fire('error', event)).not.toThrow()

    expect(reportError).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  test('does not report an event raised while a report is running', () => {
    const target = createFakeTarget()
    const reportError = vi.fn(() =>
      target.fire('error', createEvent({ error: new Error('nested') })),
    )
    installGlobalHandlers(target, reportError)

    target.fire('error', createEvent({ error: new Error('first') }))

    expect(reportError).toHaveBeenCalledOnce()
  })

  test('reports again after a report has finished', () => {
    const reportError = vi.fn()
    const target = installOnFakeTarget(reportError)

    target.fire('error', createEvent({ error: new Error('first') }))
    target.fire('error', createEvent({ error: new Error('second') }))

    expect(reportError).toHaveBeenCalledTimes(2)
  })

  test('reports again after a report threw', () => {
    const reportError = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('sink is broken')
      })
      .mockImplementation(() => {})
    const target = installOnFakeTarget(reportError)

    target.fire('error', createEvent({ error: new Error('first') }))
    target.fire('error', createEvent({ error: new Error('second') }))

    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
