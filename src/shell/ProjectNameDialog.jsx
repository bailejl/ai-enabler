import { useEffect, useId, useRef, useState } from 'react'

/**
 * A modal dialog with one required project name field, for create and rename. `problems` are the
 * problems of the last refused submit: the field is marked invalid and described by them, and
 * focus returns to it. Mounted only while open, so closing it is unmounting it.
 */
export default function ProjectNameDialog({
  title,
  label = 'Project name',
  submitText,
  initialName = '',
  problems,
  onSubmit,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const fieldRef = useRef(null)
  const [name, setName] = useState(initialName)
  const headingId = useId()
  const fieldId = useId()
  const problemsId = useId()

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  // On open and after each refused submit, so the user lands on the field to fix.
  useEffect(() => {
    fieldRef.current.focus()
  }, [problems])

  // A submit waits for the one before it, so a second Enter or click cannot save twice.
  const submitting = useRef(false)
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    try {
      await onSubmit(name)
    } finally {
      submitting.current = false
    }
  }

  // Esc is a cancel; the dialog stays open until the state closes it.
  const handleCancelEvent = (event) => {
    event.preventDefault()
    onCancel()
  }

  const isInvalid = problems.length > 0
  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={headingId}
      onCancel={handleCancelEvent}
    >
      <form className="dialog__content" onSubmit={handleSubmit} noValidate>
        <h2 id={headingId} className="dialog__heading">
          {title}
        </h2>
        <label htmlFor={fieldId}>{label}</label>
        <input
          ref={fieldRef}
          id={fieldId}
          className="dialog__field"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? problemsId : undefined}
        />
        {isInvalid && (
          <ul id={problemsId} className="dialog__problems">
            {problems.map(({ message }, index) => (
              // Messages can repeat, so the position is the identity.
              <li key={index}>{message}</li>
            ))}
          </ul>
        )}
        <div className="dialog__actions">
          <button type="submit" className="button">
            {submitText}
          </button>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
