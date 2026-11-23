import { useEffect, useId, useRef } from 'react'

/**
 * A modal question with a confirm and a cancel button; Cancel takes focus, so Enter is safe.
 * `children` is the optional body that describes the dialog. Mounted only while a confirmation is
 * pending, so closing it is just unmounting it.
 */
export default function ConfirmDialog({
  message,
  confirmText,
  cancelText = 'Cancel',
  children,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const headingId = useId()
  const bodyId = useId()

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
      aria-labelledby={headingId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={handleCancelEvent}
      onClick={handleClick}
    >
      <div className="dialog__content">
        <h2 id={headingId} className="dialog__heading">
          {message}
        </h2>
        {children && <div id={bodyId}>{children}</div>}
        <div className="dialog__actions">
          <button type="button" className="button" onClick={onConfirm}>
            {confirmText}
          </button>
          <button ref={cancelButtonRef} type="button" className="button" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </dialog>
  )
}
