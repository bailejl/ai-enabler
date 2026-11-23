import { useId, useRef, useState } from 'react'

/**
 * A card's "More actions for <name>" disclosure: a button that shows a list of action buttons.
 * Escape closes it and returns focus to the button; tabbing out or clicking outside closes it.
 * Choosing an action closes it and puts focus back on the button, then runs the action, so an
 * action with no dialog leaves focus where it was.
 * @param {{ name: string, focusKey: string, actions: { label: string, onSelect: () => void }[] }} props
 *   focusKey marks the button so the homepage can move focus to it.
 */
export default function CardMenu({ name, focusKey, actions }) {
  const [isOpen, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const listId = useId()

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape' || !isOpen) return
    event.stopPropagation()
    setOpen(false)
    buttonRef.current.focus()
  }

  // Focus that leaves the menu and its button, by Tab or a click elsewhere, closes it.
  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div className="card-menu" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="button card-menu__button"
        aria-label={`More actions for ${name}`}
        aria-expanded={isOpen}
        aria-controls={listId}
        data-focus={focusKey}
        onClick={() => setOpen((open) => !open)}
      >
        More actions
      </button>
      <ul id={listId} className="card-menu__list" hidden={!isOpen}>
        {actions.map(({ label, onSelect }) => (
          <li key={label}>
            <button
              type="button"
              className="button card-menu__item"
              onClick={() => {
                setOpen(false)
                buttonRef.current.focus()
                onSelect()
              }}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
