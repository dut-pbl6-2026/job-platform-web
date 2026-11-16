import type { CSSProperties } from "react";

export type ChartSlice = {
  label: string;
  value: number;
  /** A CSS colour, normally a token such as `var(--c-navy)`. */
  color: string;
};

export type ActivityPoint = { label: string; value: number };

/**
 * A proportion ring drawn with a conic gradient: no chart library, no canvas, and the numbers stay in
 * the legend so the chart is readable without colour. The centre carries the total.
 */
export function Donut({
  slices,
  label,
  centerValue,
  centerLabel,
  size = 148,
}: {
  slices: ChartSlice[];
  label: string;
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const stops: string[] = [];
  let angle = 0;
  for (const slice of slices) {
    const value = Math.max(0, slice.value);
    if (value === 0) continue;
    const from = (angle / total) * 360;
    angle += value;
    const to = (angle / total) * 360;
    stops.push(`${slice.color} ${from}deg ${to}deg`);
  }

  return (
    <div className="jp-donut-wrap">
      <div
        className="jp-donut"
        role="img"
        aria-label={`${label}: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(", ")}`}
        style={
          {
            width: size,
            height: size,
            background: total > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--c-rule)",
            "--jp-donut-hole": `${Math.round(size * 0.62)}px`,
          } as CSSProperties
        }
      >
        <span className="jp-donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </span>
      </div>
      <ul className="jp-legend jp-legend--stack">
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} aria-hidden="true" />
            {slice.label} <strong>{slice.value.toLocaleString("vi-VN")}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bars for a short series (7 days): value above the track, label below. */
export function ActivityBars({ points, label }: { points: ActivityPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="jp-activity" role="img" aria-label={`${label}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
      {points.map((point) => (
        <div className="jp-activity-col" key={point.label}>
          <span className="jp-activity-value">{point.value || ""}</span>
          <span className="jp-activity-track">
            <span
              className="jp-activity-fill"
              style={{ height: `${Math.round((point.value / max) * 100)}%` }}
            />
          </span>
          <span className="jp-activity-label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A horizontal bar with its value: used for latency and per-job comparisons. */
export function MeterRow({
  label,
  value,
  max,
  display,
  tone = "navy",
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tone?: "navy" | "amber" | "success" | "danger" | "muted";
}) {
  const width = max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="jp-meter-row">
      <span className="jp-meter-label">{label}</span>
      <span className="jp-meter-track">
        <span className={`jp-meter-fill is-${tone}`} style={{ width: `${width}%` }} />
      </span>
      <span className="jp-meter-value">{display}</span>
    </div>
  );
}
