// Planned-window helpers for tasks (startDate / endDate).
//
// The API exposes the dates through the `Time` scalar (RFC3339, midnight UTC
// because the columns are DATE), while <input type="date"> works with plain
// "YYYY-MM-DD" strings — these two helpers bridge that gap.

export const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** RFC3339 (or Date) → the "YYYY-MM-DD" value a date input expects. */
export function toDateInput(value) {
  if (!value) return "";
  const raw = typeof value === "string" ? value : new Date(value).toISOString();
  return raw.slice(0, 10);
}

/** "YYYY-MM-DD" from a date input → RFC3339 midnight UTC, or null when empty. */
export function toIsoDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!DATE_INPUT_PATTERN.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * True when the window is invalid (an end date before its start date). Both
 * bounds are optional, so a missing side is always accepted.
 */
export function isWindowReversed(start, end) {
  const from = toDateInput(start);
  const to = toDateInput(end);
  if (!from || !to) return false;
  return to < from;
}

// Fixed English month abbreviations keep the label stable across ICU/locale
// versions ("Sep" on one runtime, "Sept" on another).
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Human label for the planned window, e.g. "15 Sep → 20 Sep". */
export function formatWindow(start, end) {
  const fmt = (value) => {
    const iso = toDateInput(value);
    if (!iso) return "";
    const [, month, day] = iso.split("-");
    const index = Number(month) - 1;
    if (!MONTHS[index] || !day) return "";
    return `${Number(day)} ${MONTHS[index]}`;
  };
  const from = fmt(start);
  const to = fmt(end);
  if (from && to) return `${from} → ${to}`;
  if (from) return `Starts ${from}`;
  if (to) return `Ends ${to}`;
  return "";
}

/**
 * Builds the date portion of a create/update payload.
 *
 * On update a blanked field must be *cleared* rather than silently kept, so the
 * previous value is compared with the submitted one and the matching clear flag
 * is set. On create there is nothing to clear.
 */
export function buildDatePayload({ start, end, previous, isEdit = false }) {
  const startDate = toIsoDate(start);
  const endDate = toIsoDate(end);
  const payload = { startDate, endDate };
  if (isEdit) {
    const prevStart = toDateInput(previous?.startDate);
    const prevEnd = toDateInput(previous?.endDate);
    if (!startDate && prevStart) payload.clearStartDate = true;
    if (!endDate && prevEnd) payload.clearEndDate = true;
  }
  return payload;
}
