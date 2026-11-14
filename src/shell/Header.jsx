import { useEffect, useRef } from 'react'

const APP_NAME = 'AI Enabler'
const IMPORT_ACCEPT = '.json,application/json'

export const toDocumentTitle = (projectName) => `${projectName} · ${APP_NAME}`

export default function Header({ projectName, onExport, onImportFile, importButtonRef }) {
  const fileInputRef = useRef(null)

  useEffect(() => {
    document.title = toDocumentTitle(projectName)
  }, [projectName])

  // Clearing the value once the file is read lets the same file be chosen again.
  const handleFileChosen = async (event) => {
    const input = event.target
    const [file] = input.files
    try {
      if (file) await onImportFile(file)
    } finally {
      input.value = ''
    }
  }

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
      <div className="header__actions">
        <button
          ref={importButtonRef}
          type="button"
          className="header__button"
          aria-label="Import project (JSON)"
          onClick={() => fileInputRef.current.click()}
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          hidden
          onChange={handleFileChosen}
        />
        <button
          type="button"
          className="header__button"
          aria-label="Export project (JSON)"
          onClick={onExport}
        >
          Export
        </button>
      </div>
    </header>
  )
}
