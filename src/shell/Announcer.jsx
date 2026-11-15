export default function Announcer({ message }) {
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {message}
    </div>
  )
}
