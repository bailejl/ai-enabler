export const glossary = [
  { term: 'Step', definition: 'A stage of the value stream, shown as a card on the canvas' },
  { term: 'PT (process time)', definition: 'Actual work time spent on an item at a step' },
  {
    term: 'LT (lead time)',
    definition:
      'Elapsed time an item spends at a step, from arrival to departure, including waiting',
  },
  {
    term: '%C&A (percent complete and accurate)',
    definition: "Share of a step's output that needs no rework downstream",
  },
  { term: 'Queue', definition: 'Number of items waiting at a step' },
  { term: 'Batch size', definition: 'Number of items a step processes together' },
  { term: 'Flow efficiency', definition: 'Total PT ÷ total LT' },
  {
    term: 'First pass yield',
    definition:
      "Product of all steps' %C&A: the share of items that pass the whole stream without rework",
  },
  { term: 'Total queue', definition: 'Sum of the queues of all steps' },
  { term: 'Avg process time', definition: 'Total PT ÷ number of steps' },
  { term: 'Working day (d)', definition: '8 hours, used for all duration display' },
  { term: 'Project', definition: 'A named value stream map with an internal id' },
  { term: 'On target', definition: 'The metric meets its goal. No action is needed' },
  { term: 'Watch', definition: 'The metric is below its goal but not yet a problem' },
  { term: 'Needs attention', definition: 'The metric is far from its goal and needs action' },
]
