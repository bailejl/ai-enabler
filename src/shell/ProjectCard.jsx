import CardMenu from './CardMenu.jsx'

/**
 * One saved project on the homepage: its name as the link that opens it, its modified date and
 * its "More actions" menu. The list reads only the index, so every card offers every action; one
 * that needs a stored file that cannot be opened is refused with its problems.
 * `data-focus` marks the link and the menu button so the homepage can move focus to them.
 */
export default function ProjectCard({
  item,
  onRename,
  onDuplicate,
  onReplaceFromFile,
  onExport,
  onDelete,
}) {
  const { id, name } = item
  const actions = [
    { label: 'Rename', onSelect: () => onRename(id, name) },
    { label: 'Duplicate', onSelect: () => onDuplicate(id, name) },
    { label: 'Replace from file', onSelect: () => onReplaceFromFile(id, name) },
    { label: 'Export', onSelect: () => onExport(id) },
    { label: 'Delete', onSelect: () => onDelete(id, name) },
  ]
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
