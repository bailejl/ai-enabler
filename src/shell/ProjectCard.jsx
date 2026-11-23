import CardMenu from './CardMenu.jsx'

/**
 * One saved project on the homepage: its name as the link that opens it, its modified date and
 * its "More actions" menu. A project that cannot be opened offers only Export and Delete.
 * `data-focus` marks the link and the menu button so the homepage can move focus to them.
 */
export default function ProjectCard({ item, onRename, onDuplicate, onExport, onDelete }) {
  const { id, name } = item
  const repairs = [
    { label: 'Export', onSelect: () => onExport(id) },
    { label: 'Delete', onSelect: () => onDelete(id, name) },
  ]
  const actions = item.openable
    ? [
        { label: 'Rename', onSelect: () => onRename(id, name) },
        { label: 'Duplicate', onSelect: () => onDuplicate(id, name) },
        ...repairs,
      ]
    : repairs
  return (
    <li className="project-card">
      <a
        className="project-card__name"
        href={item.href}
        aria-label={`Open ${name}`}
        data-focus={`card:${id}`}
      >
        {name}
      </a>
      <span className="project-card__modified">
        Modified <time dateTime={item.modifiedAt}>{item.modifiedText}</time>
      </span>
      <CardMenu name={name} focusKey={`menu:${id}`} actions={actions} />
    </li>
  )
}
