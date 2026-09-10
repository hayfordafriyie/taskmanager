/**
 * Calendar helpers shared by the date picker.
 *
 * Values are plain `YYYY-MM-DD` strings and all maths is done in UTC so a
 * timezone can never shift a day. They live outside `components/DatePicker.tsx`
 * so that file only exports a component (keeping Fast Refresh working).
 */
import type { MonthGrid } from "../types/dates";

export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the value looks like a `YYYY-MM-DD` day. */
export function isDateString(value: string): boolean {
  return typeof value === "string" && DATE_RE.test(value);
}

/** Parse a `YYYY-MM-DD` day into a UTC midnight `Date`, or null. */
export function parseDateValue(value: string): Date | null {
  if (!isDateString(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a `Date` back to the `YYYY-MM-DD` value the API uses. */
export function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "15 Sep 2026" — stable label that does not depend on the ICU build. */
export function formatDisplayDate(value: string): string {
  const date = parseDateValue(value);
  if (!date) return "";
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Six weeks of cells (Monday first) for the given month, padded with nulls. */
export function monthGrid(year: number, monthIndex: number): MonthGrid {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, monthIndex, 1 - offset));
  const weeks: MonthGrid = [];
  for (let w = 0; w < 6; w += 1) {
    const week: Array<Date | null> = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + w * 7 + d);
      week.push(day.getUTCMonth() === monthIndex ? day : null);
    }
    weeks.push(week);
  }
  return weeks;
}
