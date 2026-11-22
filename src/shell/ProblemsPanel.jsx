import { useEffect, useRef } from 'react'

// Not a live region: the Announcer speaks every rejection, this only keeps it visible. With
// `takesFocus` the heading takes focus each time `view` is a new rejection, so the list is read
// where the user lands. `view` comes from toProblemsView.
export default function ProblemsPanel({
  view,
  label,
  onDismiss,
  takesFocus = false,
  className = '',
}) {
  const headingRef = useRef(null)

  useEffect(() => {
    if (takesFocus) headingRef.current?.focus()
  }, [takesFocus, view])

  return (
    <section aria-label={label} className={`problems-panel ${className}`.trim()}>
      <div className="problems-panel__body">
        <h2
          ref={headingRef}
          tabIndex={takesFocus ? -1 : undefined}
          className="problems-panel__heading"
        >
          {view.heading}
        </h2>
        <ul className="problems-panel__list">
          {view.items.map(({ message, fix }, index) => (
            // Messages can repeat, so the position is the identity; the list never reorders.
            <li key={index}>
              {message} <span className="problems-panel__fix">Fix: {fix}</span>
            </li>
          ))}
        </ul>
        {view.more && <p className="problems-panel__more">{view.more}</p>}
      </div>
      <button type="button" className="button" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  )
}
