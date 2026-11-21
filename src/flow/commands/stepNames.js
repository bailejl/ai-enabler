import { stepDisplayName } from '../step.js'
import { shorten } from '../text.js'

// A message lists this many valid steps; the rest are counted in "and N more". `untrusted` keeps all.
export const MAX_LISTED_STEPS = 20

// A step as a summary or a list names it: its name, then its id.
export const stepRef = (step, index) => `${stepDisplayName(step, index)} (${shorten(step.id)})`

export const validStepsText = (nodes) => {
  if (nodes.length === 0) return 'none'
  const listed = nodes.slice(0, MAX_LISTED_STEPS).map(stepRef).join(', ')
  const more = nodes.length - MAX_LISTED_STEPS
  return more > 0 ? `${listed}, and ${more} more` : listed
}

export const validStepsList = (nodes) => nodes.map(({ id, data }) => ({ id, title: data.label }))
