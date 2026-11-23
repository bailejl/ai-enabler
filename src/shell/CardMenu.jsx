import { useEffect, useId, useRef, useState } from 'react'

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
  const menuRef = useRef(null)
  const listId = useId()

  // A press outside closes it. Not blur: Safari does not focus a clicked button, so a click on an
  // item could blur the menu with no target and hide the item before the click lands.
  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [isOpen])

  const handleKeyDown = (event) => {
    if (!isOpen) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
      buttonRef.current.focus()
    }
    // Tab past the last item leaves the menu even when nothing on the page follows it.
    const items = menuRef.current.querySelectorAll('.card-menu__item')
    const isLastItem = event.target === items[items.length - 1]
    if (event.key === 'Tab' && !event.shiftKey && isLastItem) setOpen(false)
  }

  // Focus that moves to an element outside, by Tab, closes it.
  const handleBlur = (event) => {
    const next = event.relatedTarget
    if (next && !event.currentTarget.contains(next)) setOpen(false)
  }

  return (
    <div ref={menuRef} className="card-menu" onKeyDown={handleKeyDown} onBlur={handleBlur}>
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
