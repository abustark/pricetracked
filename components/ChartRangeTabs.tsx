"use client";

/**
 * Chart range selector — moves the visible history window without remounting
 * the chart. New samples stay on top; shorter windows sharpen the trend.
 */
export function ChartRangeTabs({
  ranges,
  value,
  onChange
}: {
  ranges: { id: string; label: string; days: number }[];
  value: string;
  onChange: (id: string, days: number) => void;
}) {
  return (
    <div className="range-controls" role="group" aria-label="Chart time range">
      {ranges.map((range) => {
        const selected = range.id === value;
        return (
          <button
            key={range.id}
            type="button"
            className="range-btn"
            aria-pressed={selected}
            onClick={() => onChange(range.id, range.days)}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
