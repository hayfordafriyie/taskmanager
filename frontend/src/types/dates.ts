/** Types for date handling in the UI (calendar grids, pickers). */

/** A calendar month position. */
export interface MonthCursor {
  year: number;
  /** Zero-based month index (0 = January). */
  month: number;
}

/** Six weeks of cells (Monday first); `null` marks a padding cell. */
export type MonthGrid = Array<Array<Date | null>>;

export interface DatePickerProps {
  /** Selected day as `YYYY-MM-DD`, or an empty string when unset. */
  value?: string;
  onChange?: (value: string) => void;
  /** Earliest selectable day as `YYYY-MM-DD`. */
  min?: string;
  /** Latest selectable day as `YYYY-MM-DD`. */
  max?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
