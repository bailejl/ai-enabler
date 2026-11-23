import { useEffect, useId, useRef } from 'react'

// Not a live region: the Announcer speaks every rejection, this only keeps it visible. With
// `takesFocus` the heading takes focus each time `view` is a new rejection, so the list is read
// where the user lands. `view` comes from toProblemsView. `label` names the panel's region, which
// is how two panels shown at once are told apart; `ref` is the panel's element. Without
// `onDismiss` the panel has no Dismiss button, for problems the page itself is about.
export default function ProblemsPanel({
  view,
  label,
  onDismiss,
  takesFocus = false,
  className = '',
  ref,
}) {
  const headingRef = useRef(null)
  const headingId = useId()

  useEffect(() => {
    if (takesFocus) headingRef.current?.focus()
  }, [takesFocus, view])

  return (
    <section ref={ref} aria-label={label} className={`problems-panel ${className}`.trim()}>
      <div className="problems-panel__body">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={takesFocus ? -1 : undefined}
          className="problems-panel__heading"
        >
          {view.heading}
        </h2>
        {/* The list scrolls when it is long, so the keyboard needs a way to scroll it; the heading
            names it for whoever tabs to it. */}
        <ul className="problems-panel__list" tabIndex={0} aria-labelledby={headingId}>
          {view.items.map(({ message, fix }, index) => (
            // Messages can repeat, so the position is the identity; the list never reorders.
            <li key={index}>
              {message} <span className="problems-panel__fix">Fix: {fix}</span>
            </li>
          ))}
        </ul>
        {view.more && <p className="problems-panel__more">{view.more}</p>}
      </div>
      {onDismiss && (
        <button type="button" className="button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </section>
  )
}
