/** Freshness/status pill with a status dot. Colour is never the only signal — the label carries the meaning. */
export function StatusPill({
  status,
  label
}: {
  status: "fresh" | "stale" | "error" | "paused" | "unknown";
  label: string;
}) {
  return (
    <span className="status-pill">
      <span className={`status-dot ${status}`} aria-hidden="true" />
      {label}
    </span>
  );
}
