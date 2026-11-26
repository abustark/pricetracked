/**
 * Workspace summary counts, derived from real stored state:
 * tracking (all products), targets reached, needs attention (stale or failed).
 */
export function SummaryCounts({
  tracking,
  reached,
  attention
}: {
  tracking: number;
  reached: number;
  attention: number;
}) {
  return (
    <div className="summary-counts" aria-label="Watchlist summary">
      <div className="count-card">
        <div className="count-value">{tracking}</div>
        <div className="count-label">Tracking</div>
      </div>
      <div className="count-card reached">
        <div className="count-value">{reached}</div>
        <div className="count-label">Targets reached</div>
      </div>
      <div className="count-card attention">
        <div className="count-value">{attention}</div>
        <div className="count-label">Needs attention</div>
      </div>
    </div>
  );
}
