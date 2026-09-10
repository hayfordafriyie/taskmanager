/**
 * Time-tracking types — the weekly timesheet view.
 *
 * Mirrors the GraphQL `TimeEntry`, `TimeSummary` and `LogTimeInput` types. The
 * API's `Time` scalar is RFC3339, so every timestamp here is a full ISO string;
 * date-only values are converted on the way out by `toApiTime`.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString } from "./common";

/** A date-ish value the time hooks accept: ISO string, `Date`, or nothing. */
export type TimeInput = string | Date | null | undefined;

/** One logged time entry (GraphQL `TimeEntry`). */
export interface TimeEntry {
  id: ID;
  userId: ID;
  taskId: ID | null;
  /** Title of the linked task, when the entry has one. */
  taskTitle: string | null;
  label: string;
  minutes: number;
  spentOn: ISODateString;
  note: string;
  createdAt: ISODateString;
}

/** Aggregates for the selected window (GraphQL `TimeSummary`). */
export interface TimeSummary {
  totalMinutes: number;
  entryCount: number;
  activeDays: number;
  /** Label with the most minutes logged, or `null` when there is none. */
  topLabel: string | null;
  topMinutes: number;
}

/** Payload of the `logTime` mutation (GraphQL `LogTimeInput`). */
export interface LogTimeInput {
  taskId?: ID | null;
  label?: string | null;
  minutes: number;
  spentOn?: ISODateString | null;
  note?: string | null;
}

/** Result of the `logTime` mutation (GraphQL `TimeResult`). */
export interface TimeResult {
  success: boolean;
  message: string;
  entry?: TimeEntry | null;
}

/** Response data of the `timeEntries` query. */
export interface TimeEntriesData {
  timeEntries: TimeEntry[];
}

/** Response data of the `timeSummary` query. */
export interface TimeSummaryData {
  timeSummary: TimeSummary;
}

/** Response data of the `logTime` mutation. */
export interface LogTimeData {
  logTime: TimeResult;
}

/** Response data of the `deleteTimeEntry` mutation. */
export interface DeleteTimeEntryData {
  deleteTimeEntry: boolean;
}

/** Variables of the `timeEntries` and `timeSummary` queries (RFC3339 bounds). */
export interface TimeRangeVariables extends GqlVariables {
  from: string;
  to: string;
}

/** Variables of the `logTime` mutation. */
export interface LogTimeVariables extends GqlVariables {
  input: LogTimeInput;
}

/** Variables of the `deleteTimeEntry` mutation. */
export interface DeleteTimeEntryVariables extends GqlVariables {
  entryId: ID;
}
