import { describe, expect, it } from 'vitest'
import {
  fileAccessProblems,
  missingGuides,
  noToolProblems,
  orphanGuides,
  shapeProblems,
} from './guideChecks.js'

const TITLE = 'Connection forms a loop'

// A guide that passes every shape rule; a test overrides the one part it changes.
const guide = ({
  heading = `# CONN_LOOP: ${TITLE}`,
  meaning = 'Connections lead back to a step.',
  repair = '1. Call `get_project`.',
  ask = 'None.',
} = {}) =>
  [
    heading,
    '',
    '## What it means',
    '',
    meaning,
    '',
    '## Repair with the tools',
    '',
    repair,
    '',
    '## Ask the user first',
    '',
    ask,
    '',
  ].join('\n')

describe('missingGuides', () => {
  it('names each catalog code that has no guide', () => {
    expect(missingGuides(['CONN_LOOP', 'CONN_EXAMPLE'], { CONN_LOOP: guide() })).toEqual([
      'CONN_EXAMPLE',
    ])
  })

  it('names nothing when every code has a guide', () => {
    expect(missingGuides(['CONN_LOOP'], { CONN_LOOP: guide() })).toEqual([])
  })

  it('does not count a code that is only an inherited object key as having a guide', () => {
    expect(missingGuides(['constructor'], {})).toEqual(['constructor'])
  })
})

describe('orphanGuides', () => {
  it('names each guide whose code is not in the catalog', () => {
    expect(orphanGuides(['CONN_LOOP'], { CONN_LOOP: guide(), CONN_GONE: guide() })).toEqual([
      'CONN_GONE',
    ])
  })

  it('is case-sensitive, so a lowercase file name is an orphan', () => {
    expect(orphanGuides(['CONN_LOOP'], { conn_loop: guide() })).toEqual(['conn_loop'])
  })

  it('names nothing when every guide has a catalog code', () => {
    expect(orphanGuides(['CONN_LOOP'], { CONN_LOOP: guide() })).toEqual([])
  })
})

describe('shapeProblems', () => {
  const check = (text) => shapeProblems('CONN_LOOP', TITLE, text)

  it('passes a guide with the catalog title and the three sections', () => {
    expect(check(guide())).toEqual([])
  })

  it('names the guide and the expected title when line 1 is not exactly the heading', () => {
    const problems = check(guide({ heading: '# CONN_LOOP: A loop' }))

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('CONN_LOOP')
    expect(problems[0]).toContain('# CONN_LOOP: Connection forms a loop')
  })

  it('fails a heading with trailing text after the title', () => {
    expect(check(guide({ heading: `# CONN_LOOP: ${TITLE} (old)` }))).toHaveLength(1)
  })

  it('fails when the title heading is not on line 1', () => {
    expect(check(`\n${guide()}`)).toHaveLength(1)
  })

  it('passes a guide with extra blank lines after the heading', () => {
    expect(check(guide().replace('\n\n## What', '\n\n\n\n## What'))).toEqual([])
  })

  it('names the guide and the missing section', () => {
    const text = guide().replace('## Ask the user first\n\nNone.\n', '')
    const problems = check(text)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('CONN_LOOP')
    expect(problems[0]).toContain('## Ask the user first')
  })

  it('fails a section that appears twice', () => {
    const problems = check(`${guide()}\n## Ask the user first\n\nNone.\n`)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('## Ask the user first')
  })

  it('fails sections that are out of order', () => {
    const text = [
      `# CONN_LOOP: ${TITLE}`,
      '## Repair with the tools',
      '1. Call `get_project`.',
      '## What it means',
      'A loop.',
      '## Ask the user first',
      'None.',
    ].join('\n')

    expect(check(text).join('\n')).toContain('out of order')
  })

  it('fails a section with only blank lines under its heading', () => {
    const problems = check(guide({ meaning: '   ' }))

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('## What it means')
  })

  it('passes a section that holds one word', () => {
    expect(check(guide({ meaning: 'Loop.', ask: 'No.' }))).toEqual([])
  })

  it('fails a repair section with neither a numbered step nor the marker', () => {
    const problems = check(guide({ repair: 'Call get_project.' }))

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('CONN_LOOP')
    expect(problems[0]).toContain('## Repair with the tools')
  })

  it('passes a numbered step that names no tool', () => {
    expect(check(guide({ repair: '1. Ask nicely.' }))).toEqual([])
  })

  it('fails a numbered step that is only in a different section', () => {
    expect(check(guide({ repair: 'Do something.', ask: '1. Ask.' }))).toHaveLength(1)
  })

  it('passes the no-tool marker in place of a numbered step', () => {
    expect(
      check(guide({ repair: 'No tool repairs this.\n\nTell the user to choose another file.' })),
    ).toEqual([])
  })

  it('fails the marker with extra words on its line', () => {
    expect(check(guide({ repair: 'No tool repairs this. Sorry.' }))).toHaveLength(1)
  })

  it('reports each broken rule, not only the first', () => {
    const text = guide({ heading: '# CONN_LOOP: Wrong', repair: 'Nothing.' })

    expect(check(text)).toHaveLength(2)
  })
})

describe('fileAccessProblems', () => {
  it('passes a guide that sends no one to the file', () => {
    expect(fileAccessProblems(guide())).toEqual([])
  })

  it.each([
    'Use the Read tool on the project file.',
    'Use the Edit tool to change it.',
    'Use the Write tool to save it.',
    'Then edit the JSON until it parses.',
    'Then edit the file until it parses.',
    'Fix it by hand.',
    'Open the file in an editor.',
  ])('fails the line "%s" and names it', (line) => {
    const problems = fileAccessProblems(guide({ repair: `1. ${line}` }))

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(line)
  })

  it('matches the phrases whatever the letter case', () => {
    expect(fileAccessProblems('EDIT THE JSON now')).toHaveLength(1)
  })

  it('passes a line that starts with "Tell the user", even with a phrase in it', () => {
    expect(fileAccessProblems("Tell the user to repair the file's JSON by hand.")).toEqual([])
  })

  it('fails a line that only mentions "Tell the user" after other words', () => {
    expect(fileAccessProblems('1. Tell the user to fix it by hand.')).toHaveLength(1)
  })

  it('passes a paraphrase, which review catches instead', () => {
    expect(fileAccessProblems('Change the text in an editor.')).toEqual([])
  })

  it('names the line number', () => {
    expect(fileAccessProblems('fine\nFix it by hand.')[0]).toContain('line 2')
  })
})

describe('noToolProblems', () => {
  const NO_TOOL = 'No tool repairs this.\n\nTell the user to choose another file.'
  const check = (text) => noToolProblems('CONN_LOOP', text)

  it('passes the marker followed by a line that starts "Tell the user"', () => {
    expect(check(guide({ repair: NO_TOOL }))).toEqual([])
  })

  it('names the guide when the repair section uses a numbered step, not the marker', () => {
    const problems = check(guide({ repair: '1. Tell the user to choose another file.' }))

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('CONN_LOOP')
  })

  it('fails the marker with nothing after it', () => {
    expect(check(guide({ repair: 'No tool repairs this.' }))).toHaveLength(1)
  })

  it('fails the marker followed by a line that does not start "Tell the user"', () => {
    expect(check(guide({ repair: 'No tool repairs this.\n\nChoose another file.' }))).toHaveLength(
      1,
    )
  })

  it('fails a "Tell the user" line that comes before the marker', () => {
    const repair = 'Tell the user to choose another file.\n\nNo tool repairs this.'

    expect(check(guide({ repair }))).toHaveLength(1)
  })

  it('does not count the marker in another section', () => {
    expect(check(guide({ ask: NO_TOOL }))).toHaveLength(1)
  })
})
