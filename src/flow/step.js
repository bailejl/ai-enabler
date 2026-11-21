import { hasText, quoted } from './text.js'

export { hasText }

export const STEP_TYPE = 'step'

// Every field a step's data may carry. Export copies these; validation must cover each optional one.
export const STEP_DATA_FIELDS = ['label', 'pt', 'lt', 'ca', 'queue', 'batch']

// A step without a usable title is named by its 1-based position in the file or map.
export const stepPositionName = (index) => `Step #${index + 1}`

// React Flow names a node for assistive technology by its ariaLabel. It is runtime only, so an
// export never carries it. A blank title falls back to the step's position.
export const withAriaLabel = (node, index) => ({
  ...node,
  ariaLabel: hasText(node.data.label) ? node.data.label : stepPositionName(index),
})

// How a message names a step: its title in quotes, or its position when the title is blank.
export const stepDisplayName = (step, index) =>
  hasText(step.data.label) ? quoted(step.data.label) : stepPositionName(index)

// The step with this id and its place in the list, or null.
export const findStep = (nodes, id) => {
  const index = nodes.findIndex((node) => node.id === id)
  return index === -1 ? null : { step: nodes[index], index }
}
