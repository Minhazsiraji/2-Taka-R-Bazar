export function StatusPill({ status }: { status: string }) {
  const label = status === 'ready_for_pickup' ? 'ready for fulfilment' : status.replaceAll('_', ' ')
  return <span className="status-pill">{label}</span>
}
