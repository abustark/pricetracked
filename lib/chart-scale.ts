/**
 * Timestamp-scaled x-axis for the price chart.
 *
 * X coordinates are derived from observation timestamps, not from the sample
 * index: two scans minutes apart must occupy a smaller horizontal interval than
 * two scans a month apart. Long gaps therefore appear as gaps instead of being
 * compressed into a fixed-width index spacing.
 */
export function timeScaleX(times: number[], width: number, padding: number): number[] {
  if (times.length === 0) return [];
  if (times.length === 1) return [width / 2];

  const first = times[0];
  const last = times[times.length - 1];
  const t0 = Math.min(first, last);
  const t1 = Math.max(first, last);
  const span = t1 - t0 || 1;

  return times.map((time) => padding + ((time - t0) / span) * (width - padding * 2));
}
