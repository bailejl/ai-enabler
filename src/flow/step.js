export const STEP_TYPE = 'step'

// Every field a step's data may carry. Export copies these; validation must cover each optional one.
export const STEP_DATA_FIELDS = ['label', 'pt', 'lt', 'ca', 'queue', 'batch']

// A step without a usable title is named by its 1-based position in the file or map.
export const stepPositionName = (index) => `Step #${index + 1}`

export const hasText = (value) => typeof value === 'string' && value.trim() !== ''

// React Flow names a node for assistive technology by its ariaLabel. It is runtime only, so an
// export never carries it. A blank title falls back to the step's position.
export const withAriaLabel = (node, index) => ({
  ...node,
  ariaLabel: hasText(node.data.label) ? node.data.label : stepPositionName(index),
})
