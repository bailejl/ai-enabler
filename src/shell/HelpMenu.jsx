import { glossary } from './glossary.js'

const howToUse = [
  'Connect steps by dragging from the edge of one step to another step.',
  'Delete a step or a connection by selecting it and pressing Backspace or Delete.',
  'Export saves the map as a file. Import loads a saved file.',
  'A working day is 8 hours, and all durations use it.',
  'Ratings read On target, Watch, or Needs attention. The Glossary explains each.',
  'Projects save automatically in this browser after every change.',
  'With one project open in two tabs, the last change wins.',
  "Clearing this site's data deletes its projects. Export to keep a copy.",
]

const HELP_PLACEHOLDER = 'Help content is coming soon.'

function Section({ title, children }) {
  return (
    <details className="menu__section">
      <summary className="menu__summary">{title}</summary>
      <div className="menu__body">{children}</div>
    </details>
  )
}

export default function HelpMenu() {
  return (
    <nav aria-label="Help" className="menu">
      <Section title="How to use">
        {howToUse.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </Section>
      <Section title="Glossary">
        <dl>
          {glossary.map(({ term, definition }) => (
            <div key={term} className="menu__entry">
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Help">
        <p>{HELP_PLACEHOLDER}</p>
      </Section>
    </nav>
  )
}
