import { useMemo, useState } from "react";
import type { DonutArc, DonutChartProps, DonutSlice } from "../types/charts";

/**
 * SVG donut chart.
 *
 * A real ring (not a filled pie): each slice is an arc drawn with
 * stroke-dasharray on a circle, so it scales cleanly at any size, keeps a hole
 * for the headline number, and highlights on hover/focus — from the segment or
 * from the legend.
 */
export default function DonutChart({
  data = [],
  size = 176,
  thickness = 22,
  gapDegrees = 1.5,
  centerCaption = "tasks",
  showLegend = true,
  ariaLabel = "Tasks by status",
}: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const slices = useMemo(() => data.filter((d) => Number(d.count) > 0), [data]);
  const total = useMemo(
    () => data.reduce((sum, d) => sum + Number(d.count || 0), 0),
    [data],
  );

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapLength = (gapDegrees / 360) * circumference;

  // Precompute each arc's length and start offset around the ring.
  let consumed = 0;
  const arcs: DonutArc[] = slices.map((slice) => {
    const fraction = total > 0 ? Number(slice.count) / total : 0;
    const full = fraction * circumference;
    // only inset the arc when the slice is big enough to survive the gap
    const arcLength = full > gapLength * 2 ? full - gapLength : full;
    const arc: DonutArc = {
      ...slice,
      percent: Math.round(fraction * 100),
      dash: `${Math.max(arcLength, 0)} ${Math.max(circumference - arcLength, 0)}`,
      offset: -consumed,
    };
    consumed += full;
    return arc;
  });

  const active = arcs.find((a) => a.key === activeKey) || null;
  const centerValue = active ? active.count : total;
  const centerText = active ? active.label : centerCaption;

  if (total === 0) {
    return (
      <div className="flex items-center gap-6">
        <div
          className="relative shrink-0"
          style={{ width: size, height: size }}
          role="img"
          aria-label={`${ariaLabel}: no data yet`}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden="true"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              className="t-faint opacity-15"
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold t-ink">0</span>
            <span className="text-xs t-soft">{centerCaption}</span>
          </div>
        </div>
        {showLegend && (
          <p className="text-sm t-soft">
            No tasks yet — create one from the Board.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${ariaLabel}: ${arcs
          .map((a) => `${a.label} ${a.count} of ${total} (${a.percent}%)`)
          .join(", ")}`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {arcs.map((a) => {
            const isActive = a.key === activeKey;
            return (
              <circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={a.color}
                strokeWidth={isActive ? thickness + 6 : thickness}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                strokeLinecap="round"
                className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                style={{ opacity: activeKey && !isActive ? 0.35 : 1 }}
                onMouseEnter={() => setActiveKey(a.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(a.key)}
                onBlur={() => setActiveKey(null)}
                tabIndex={0}
              >
                <title>{`${a.label}: ${a.count} (${a.percent}%)`}</title>
              </circle>
            );
          })}
        </svg>

        {/* the hole: headline number, or the hovered slice */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="font-display text-3xl font-bold leading-none t-ink">
            {centerValue}
          </span>
          <span className="mt-1 truncate text-[0.7rem] font-medium uppercase tracking-wide t-soft">
            {centerText}
          </span>
          {active && <span className="text-xs t-faint">{active.percent}%</span>}
        </div>
      </div>

      {showLegend && (
        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((s) => {
            const percent =
              total > 0 ? Math.round((Number(s.count) / total) * 100) : 0;
            const isActive = s.key === activeKey;
            return (
              <li
                key={s.key}
                onMouseEnter={() => setActiveKey(s.key)}
                onMouseLeave={() => setActiveKey(null)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${
                  isActive ? "bg-white/5" : ""
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate t-soft">{s.label}</span>
                <span className="shrink-0 text-xs t-faint">{percent}%</span>
                <span className="w-8 shrink-0 text-right font-medium t-ink">
                  {s.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
