import { useEffect } from 'react'

const APP_NAME = 'AI Enabler'

export const toDocumentTitle = (projectName) => `${projectName} · ${APP_NAME}`

export default function Header({ projectName }) {
  useEffect(() => {
    document.title = toDocumentTitle(projectName)
  }, [projectName])

  return (
    <header className="header">
      <svg className="header__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="5" cy="12" r="3" />
        <circle cx="19" cy="12" r="3" />
        <path d="M8 12h8" />
      </svg>
      <span className="header__brand">{APP_NAME}</span>
      <span className="header__divider" role="separator" aria-orientation="vertical" />
      <span className="header__project" title={projectName}>
        {projectName}
      </span>
    </header>
  )
}
