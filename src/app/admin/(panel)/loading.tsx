export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-mist" />
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-mist" />
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-mist" />
    </div>
  )
}
