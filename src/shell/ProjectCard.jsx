/** One saved project on the homepage: its name as the link that opens it, and its modified date. */
export default function ProjectCard({ item }) {
  return (
    <li className="project-card">
      <a className="project-card__name" href={item.href} aria-label={`Open ${item.name}`}>
        {item.name}
      </a>
      <span className="project-card__modified">
        Modified <time dateTime={item.modifiedAt}>{item.modifiedText}</time>
      </span>
    </li>
  )
}
