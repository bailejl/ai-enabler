const JSON_MIME_TYPE = 'application/json'

// Browser edge: hands text to the user as a file download via a temporary anchor.
export const downloadTextFile = (fileName, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: JSON_MIME_TYPE }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
