import { useEffect, useRef } from 'react'

const HEADING_ID = 'confirm-dialog-heading'

// Mounted only while a confirmation is pending, so closing it is just unmounting it.
export default function ConfirmDialog({ message, currentName, incomingName, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)

  useEffect(() => {
    dialogRef.current.showModal()
    cancelButtonRef.current.focus()
  }, [])

  // Esc is a cancel; keeping the dialog open until the state changes avoids a second close path.
  const handleCancelEvent = (event) => {
    event.preventDefault()
    onCancel()
  }

  // A click on the backdrop lands on the dialog element itself; clicks inside land on its content.
  const handleClick = (event) => {
    if (event.target === event.currentTarget) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={HEADING_ID}
      onCancel={handleCancelEvent}
      onClick={handleClick}
    >
      <div className="dialog__content">
        <h2 id={HEADING_ID} className="dialog__heading">
          {message}
        </h2>
        <p>
          Current project: <strong>{currentName}</strong>. Incoming project:{' '}
          <strong>{incomingName}</strong>.
        </p>
        <div className="dialog__actions">
          <button type="button" className="dialog__button" onClick={onConfirm}>
            Replace map
          </button>
          <button ref={cancelButtonRef} type="button" className="dialog__button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  )
}
