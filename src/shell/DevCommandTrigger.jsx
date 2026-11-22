import { useEffect } from 'react'
import { DEV_COMMAND_EVENT, DEV_COMMAND_READY_ATTRIBUTE, parseDevCommand } from './devCommand.js'

// Dev only: runs the commands in the dev command event's `detail` as one edit through `onCommands`.
export default function DevCommandTrigger({ onCommands }) {
  useEffect(() => {
    const onCommandEvent = (event) => {
      const commands = parseDevCommand(event.detail)
      if (commands) onCommands(commands)
    }
    window.addEventListener(DEV_COMMAND_EVENT, onCommandEvent)
    // e2e tests wait for this before dispatching, so the event cannot arrive before the listener.
    document.documentElement.setAttribute(DEV_COMMAND_READY_ATTRIBUTE, '')
    return () => {
      window.removeEventListener(DEV_COMMAND_EVENT, onCommandEvent)
      document.documentElement.removeAttribute(DEV_COMMAND_READY_ATTRIBUTE)
    }
  }, [onCommands])

  return null
}
