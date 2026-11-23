const IMPORT_ACCEPT = '.json,application/json'

/**
 * The hidden project file picker a button opens with `ref.current.click()`. It hands the chosen
 * file to `onFile` and then clears itself, so the same file can be chosen again.
 */
export default function FileInput({ ref, onFile }) {
  const handleChange = async (event) => {
    const input = event.target
    const [file] = input.files
    try {
      if (file) await onFile(file)
    } finally {
      input.value = ''
    }
  }
  return <input ref={ref} type="file" accept={IMPORT_ACCEPT} hidden onChange={handleChange} />
}
