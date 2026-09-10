/** Types for date handling in the UI (calendar grids, pickers). */
import type { ISODateString } from "./common";
import type { Task } from "./tasks";

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

// ---------------------------------------------------------------------------
// Calendar view (`modules/home/views/CalendarView`)
// ---------------------------------------------------------------------------

/** The three segments of the calendar's filter control. */
export type CalendarFilter = "all" | "assigned" | "created";

/** One segment of the calendar's filter control. */
export interface CalendarFilterOption {
  key: CalendarFilter;
  label: string;
}

/**
 * A task the calendar can place on a day: it has a deadline, so `dueAt` is
 * known to be a string rather than the nullable value every task carries.
 */
export type DatedTask = Task & { dueAt: ISODateString };

/** Props of the calendar's single day cell. */
export interface CalendarDayCellProps {
  /** Day of the month, or `null` for a leading padding cell. */
  day: number | null;
  /** Tasks due on this day (empty for padding cells). */
  tasks: Task[];
  /** Highlights the cell when the day is today. */
  isToday?: boolean;
}
