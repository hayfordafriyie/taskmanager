/** Types for the chart primitives (`components/DonutChart`). */

/** One slice of a donut chart. */
export interface DonutSlice {
  key: string;
  label: string;
  count: number;
  /** Any CSS colour (usually a `var(--…)` token). */
  color: string;
}

/**
 * A slice with its geometry resolved for rendering — the private shape
 * `DonutChart` computes before drawing each arc.
 */
export interface DonutArc extends DonutSlice {
  /** Share of the total, rounded to a whole percent. */
  percent: number;
  /** `stroke-dasharray` value for the arc. */
  dash: string;
  /** `stroke-dashoffset` value for the arc. */
  offset: number;
}

export interface DonutChartProps {
  data?: DonutSlice[];
  /** Outer diameter in pixels. */
  size?: number;
  /** Ring stroke width in pixels. */
  thickness?: number;
  /** Gap between adjacent arcs, in degrees. */
  gapDegrees?: number;
  /** Caption shown under the total when nothing is hovered. */
  centerCaption?: string;
  showLegend?: boolean;
  /** Accessible name describing what the chart shows. */
  ariaLabel?: string;
}
