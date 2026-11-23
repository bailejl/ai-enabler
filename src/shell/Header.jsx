import { useEffect, useRef } from 'react'
import FileInput from './FileInput.jsx'

export const APP_NAME = 'AI Enabler'

export const toDocumentTitle = (projectName) => `${projectName} · ${APP_NAME}`

export default function Header({
  projectName,
  onExport,
  onImportFile,
  importButtonRef,
  onHomeClick,
}) {
  const fileInputRef = useRef(null)

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
      <a className="header__brand" href="#/" onClick={onHomeClick}>
        {APP_NAME}
      </a>
      <span className="header__divider" role="separator" aria-orientation="vertical" />
      <span className="header__project" title={projectName}>
        {projectName}
      </span>
      <div className="header__actions">
        <button
          ref={importButtonRef}
          type="button"
          className="button"
          aria-label="Import project (JSON)"
          onClick={() => fileInputRef.current.click()}
        >
          Import
        </button>
        <FileInput ref={fileInputRef} onFile={onImportFile} />
        <button
          type="button"
          className="button"
          aria-label="Export project (JSON)"
          onClick={onExport}
        >
          Export
        </button>
      </div>
    </header>
  )
}
