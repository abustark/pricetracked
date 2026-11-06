"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";

type ChartSample = {
  price: number;
  capturedAt: string;
  source?: "direct" | "proxy";
};

export function PriceChart({
  samples,
  currency,
  mrp
}: {
  samples: ChartSample[];
  currency: string;
  mrp?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 720;
  const height = 300;
  const padding = 34;

  const chartSamples = useMemo(() => downsample(samples, 220), [samples]);
  const prices = useMemo(() => {
    if (chartSamples.length === 0) return [0];
    const list = chartSamples.map((sample) => sample.price);
    if (mrp && mrp > 0) list.push(mrp);
    return list;
  }, [chartSamples, mrp]);

  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const rawSpread = rawMax - rawMin;

  const minSpread = Math.max(Math.round(rawMax * 0.08), 25);
  const min = rawSpread < minSpread ? Math.max(0, rawMax - minSpread) : rawMin;
  const max = rawMax;
  const range = Math.max(max - min, 1);

  const points = useMemo(() => {
    if (chartSamples.length === 0) return [];
    return chartSamples.map((sample, index) => {
      const x =
        chartSamples.length === 1
          ? width / 2
          : padding + (index / (chartSamples.length - 1)) * (width - padding * 2);
      const y = height - padding - ((sample.price - min) / range) * (height - padding * 2);
      return { x, y, sample, index };
    });
  }, [chartSamples, min, range, width, height, padding]);

  const path = useMemo(
    () => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
    [points]
  );
  const areaPath = useMemo(
    () =>
      points.length === 0
        ? ""
        : `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`,
    [path, points, height, padding]
  );

  const mrpY = mrp ? height - padding - ((mrp - min) / range) * (height - padding * 2) : undefined;

  // Determine current active point (defaults to latest point if none hovered, or hovered point)
  const activePoint = activeIndex !== null ? points[activeIndex] : null;

  if (samples.length === 0) {
    return (
      <div className="chart-empty">
        <span className="empty-icon">
          <Icon name="trend" size={18} />
        </span>
        <p>No price history yet. Scan again to add another observation.</p>
      </div>
    );
  }

  const handlePointerInteraction = (clientX: number) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const scale = width / rect.width;
    const svgX = (clientX - rect.left) * scale;

    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setActiveIndex(closestIdx);
  };

  return (
    <div className="chart-wrap">
      {/* Interactive Active Point Banner for Mobile & Desktop inspection */}
      <div className="chart-active-bar" role="status" aria-live="polite">
        {activePoint ? (
          <div className="chart-active-info">
            <span className="chart-active-tag">
              {activePoint.sample.source === "proxy" ? "Proxy scan" : "Live scan"}
            </span>
            <strong className="chart-active-price">
              {formatMoney(activePoint.sample.price, currency)}
            </strong>
            <span className="chart-active-date">
              {formatDate(activePoint.sample.capturedAt)}
            </span>
            {mrp && mrp > activePoint.sample.price ? (
              <span className="chart-active-savings">
                ({formatMoney(mrp - activePoint.sample.price, currency)} below MRP)
              </span>
            ) : null}
          </div>
        ) : (
          <div className="chart-active-idle">
            <Icon name="trend" size={14} />
            <span>Tap or drag across timeline to inspect prices</span>
          </div>
        )}
      </div>

      <div className="chart-svg-container">
        <svg
          ref={svgRef}
          className="chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Price history chart. Current ${formatMoney(samples[samples.length - 1].price, currency)}. Lowest ${formatMoney(Math.min(...samples.map((s) => s.price)), currency)}. Highest ${formatMoney(Math.max(...samples.map((s) => s.price)), currency)}.`}
          tabIndex={0}
          onPointerMove={(e) => handlePointerInteraction(e.clientX)}
          onPointerDown={(e) => handlePointerInteraction(e.clientX)}
          onPointerLeave={() => setActiveIndex(null)}
          onKeyDown={(e) => {
            if (points.length === 0) return;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, points.length - 1)));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => (prev === null ? points.length - 1 : Math.max(prev - 1, 0)));
            } else if (e.key === "Home") {
              e.preventDefault();
              setActiveIndex(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setActiveIndex(points.length - 1);
            } else if (e.key === "Escape") {
              setActiveIndex(null);
            }
          }}
          onBlur={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 1, 2].map((line) => {
            const y = padding + (line / 2) * (height - padding * 2);
            return (
              <line
                key={line}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeDasharray="3 6"
              />
            );
          })}

          {/* MRP reference line if present */}
          {mrpY !== undefined ? (
            <g>
              <line
                x1={padding}
                x2={width - padding}
                y1={mrpY}
                y2={mrpY}
                stroke="rgb(245, 158, 11)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <text
                x={width - padding}
                y={Math.max(padding + 12, mrpY - 5)}
                textAnchor="end"
                fontSize="10"
                fill="rgb(245, 158, 11)"
                fontWeight="600"
              >
                {mrp ? `MRP: ${formatMoney(mrp, currency)}` : ""}
              </text>
            </g>
          ) : null}

          <text x={padding} y={padding - 10} fontSize="12" fill="var(--muted)">
            {formatMoney(max, currency)}
          </text>
          <text x={padding} y={height - 8} fontSize="12" fill="var(--muted)">
            {formatMoney(min, currency)}
          </text>

          <path d={areaPath} fill="url(#chart-fill)" />
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Active Crosshair Guideline */}
          {activePoint ? (
            <g>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={padding}
                y2={height - padding}
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
              />
            </g>
          ) : null}

          {/* Data Points */}
          {points.map((point, index) => {
            const isLatest = index === points.length - 1;
            const isActive = activeIndex === index;

            return (
              <g key={`${point.sample.capturedAt}-${point.sample.price}-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 7.5 : isLatest ? 6.5 : 4.5}
                  fill={isActive || isLatest ? "var(--accent)" : "var(--surface-solid)"}
                  stroke="var(--accent)"
                  strokeWidth={3}
                />

                {/* Highlight ring if active */}
                {isActive ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={11}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    opacity="0.5"
                    filter="url(#glow)"
                  />
                ) : null}
              </g>
            );
          })}

          {chartSamples.length > 1 ? (
            <>
              <text x={padding} y={height - 1} fontSize="10" fill="var(--muted)">
                {formatShortDate(chartSamples[0].capturedAt)}
              </text>
              <text
                x={width - padding}
                y={height - 1}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted)"
              >
                {formatShortDate(chartSamples[chartSamples.length - 1].capturedAt)}
              </text>
            </>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div className="chart-caption">
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="chart-legend-dot" /> Live scan
          </span>
          {mrp ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "rgb(245, 158, 11)" }}>
              <span
                style={{
                  width: "12px",
                  height: "2px",
                  borderTop: "2px dashed rgb(245, 158, 11)",
                  display: "inline-block"
                }}
              />{" "}
              MRP
            </span>
          ) : null}
        </div>
        <span>{samples.length} {samples.length === 1 ? "snapshot" : "snapshots"}</span>
      </div>
    </div>
  );
}

function downsample<T extends { price: number }>(samples: T[], maxPoints: number): T[] {
  if (samples.length <= maxPoints) return samples;

  const important = new Set([0, samples.length - 1]);
  let lowestIndex = 0;
  let highestIndex = 0;

  samples.forEach((sample, index) => {
    if (sample.price < samples[lowestIndex].price) lowestIndex = index;
    if (sample.price > samples[highestIndex].price) highestIndex = index;
  });

  important.add(lowestIndex);
  important.add(highestIndex);
  const remaining = Math.max(0, maxPoints - important.size);
  const step = (samples.length - 1) / (remaining + 1);

  for (let index = 1; index <= remaining; index += 1) {
    important.add(Math.round(index * step));
  }

  return [...important]
    .sort((a, b) => a - b)
    .slice(0, maxPoints)
    .map((index) => samples[index]);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}
