import catalog from './catalog.json' with { type: 'json' }

export const CATALOG_CODES = Object.keys(catalog)

export const isCatalogCode = (code) => Object.hasOwn(catalog, code)

const PLACEHOLDER = /\{(\w+)\}/g

// One pass, so a value that looks like a placeholder is never expanded. A placeholder with no
// value stays as written, so the gap is visible instead of silently blank.
const fillTemplate = (template, params) =>
  template.replace(PLACEHOLDER, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )

/**
 * Builds a problem from the catalog. `details.params` fills the message template; the rest of
 * `details` (stepId, edgeId, field, untrusted) is carried through. User text belongs in
 * `untrusted` and in `params` (rendered into the message only), never in other fields.
 * `params` is not kept on the result. code, severity, message and fix always come from the
 * catalog, whatever `details` holds. Throws on a code that is not in the catalog.
 */
export const problem = (code, details = {}) => {
  if (!isCatalogCode(code)) throw new Error(`Unknown diagnostic code: ${String(code)}`)
  const { params = {}, ...rest } = details
  const entry = catalog[code]
  return {
    ...rest,
    code,
    severity: entry.severity,
    message: fillTemplate(entry.message, params),
    fix: entry.fix,
  }
}
