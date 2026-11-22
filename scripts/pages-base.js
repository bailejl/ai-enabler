// The URL prefix GitHub Pages serves the site under: https://<user>.github.io/<repo>/.
export const PAGES_BASE = '/ai-enabler/'

// A production build and its preview use the Pages prefix; the dev server stays at the root.
export const viteBase = ({ command, isPreview }) =>
  command === 'build' || isPreview ? PAGES_BASE : '/'
