import { Handle, Position } from '@xyflow/react'
import { stepView } from '../flow/stepView.js'

function Badge({ badge, variant }) {
  return (
    <span className={`badge badge--${variant}`}>
      <span aria-hidden="true">{badge.text}</span>
      <span className="visually-hidden">{badge.name}</span>
    </span>
  )
}

export default function StepCard({ data }) {
  const { title, rows, queueBadge, batchBadge } = stepView(data)

  return (
    <div className="step-card">
      <Handle type="target" position={Position.Left} />
      {queueBadge && <Badge badge={queueBadge} variant="queue" />}
      {batchBadge && <Badge badge={batchBadge} variant="batch" />}
      <h2 className="step-card__title">{title}</h2>
      <dl className="step-card__rows">
        {rows.map(({ key, abbreviation, spokenName, text }) => (
          <div key={key} className="step-card__row">
            <dt>
              <span aria-hidden="true">{abbreviation}</span>
              <span className="visually-hidden">{spokenName}</span>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
