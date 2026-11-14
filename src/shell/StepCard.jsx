import { Handle, Position, useConnection, useNodeConnections } from '@xyflow/react'
import { toStepView } from '../flow/stepView.js'

function Badge({ badge, variant }) {
  return (
    <span className={`badge badge--${variant}`}>
      <span aria-hidden="true">{badge.text}</span>
      <span className="visually-hidden">{badge.name}</span>
    </span>
  )
}

// Unconnected handles stay hidden until hovered, unless a connection drag is in progress.
const handleClassName = ({ isConnected, isConnectionInProgress }) =>
  isConnected || isConnectionInProgress
    ? 'step-card__handle step-card__handle--shown'
    : 'step-card__handle'

export default function StepCard({ data }) {
  const { title, rows, queueBadge, batchBadge } = toStepView(data)
  const isConnectionInProgress = useConnection((connection) => connection.inProgress)
  const hasIncoming = useNodeConnections({ handleType: 'target' }).length > 0
  const hasOutgoing = useNodeConnections({ handleType: 'source' }).length > 0

  return (
    <div className="step-card">
      <Handle
        type="target"
        position={Position.Left}
        className={handleClassName({ isConnected: hasIncoming, isConnectionInProgress })}
      />
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
      <Handle
        type="source"
        position={Position.Right}
        className={handleClassName({ isConnected: hasOutgoing, isConnectionInProgress })}
      />
    </div>
  )
}
