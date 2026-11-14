export const STEP_TYPE = 'step'

// Every field a step's data may carry. Export copies these; validation must cover each optional one.
export const STEP_DATA_FIELDS = ['label', 'pt', 'lt', 'ca', 'queue', 'batch']

// React Flow names a node for assistive technology by its ariaLabel. It is runtime only, so an
// export never carries it.
export const withAriaLabel = (node) => ({ ...node, ariaLabel: node.data.label })
