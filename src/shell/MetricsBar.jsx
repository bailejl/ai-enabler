import { toMetricTiles } from '../flow/metrics.js'

export default function MetricsBar({ steps }) {
  return (
    <section aria-label="Metrics" className="metrics">
      <dl className="metrics__list">
        {toMetricTiles(steps).map(({ key, label, text, status, statusLabel }) => (
          <div key={key} className={`metric metric--${status ?? 'none'}`}>
            <dt className="metric__label">{label}</dt>
            <dd className="metric__value">
              {text}
              {statusLabel && (
                <>
                  {' '}
                  <span className="metric__status">{statusLabel}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
