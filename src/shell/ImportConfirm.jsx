import { IMPORT_CONFIRMING } from '../flow/importFlow.js'
import ConfirmDialog from './ConfirmDialog.jsx'

/**
 * The "Replace <current> with <incoming>?" question of an import, with the file's notices, while
 * the import flow is confirming. The map's Import and a card's "Replace from file" share it.
 */
export default function ImportConfirm({ state, onConfirm, onCancel }) {
  if (state.type !== IMPORT_CONFIRMING) return null
  return (
    <ConfirmDialog
      message={state.message}
      confirmText="Replace map"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        Current project: <strong>{state.currentName}</strong>. Incoming project:{' '}
        <strong>{state.incomingName}</strong>.
      </p>
      {state.notices.map((notice) => (
        <p key={notice}>{notice}</p>
      ))}
    </ConfirmDialog>
  )
}
