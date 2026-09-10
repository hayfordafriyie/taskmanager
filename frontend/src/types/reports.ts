/**
 * Reports types — the workspace analytics view.
 *
 * Mirrors the GraphQL `Reports` type: completions per day, a status breakdown,
 * the per-member workload and the headline counters.
 */
import type { ID } from "./common";

/** One bar of the completions chart (GraphQL `ReportPoint`). */
export interface ReportPoint {
  label: string;
  value: number;
}

/** One slice of the status donut (GraphQL `ReportSlice`). */
export interface ReportSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
}

/** One row of the team-workload list (GraphQL `ReportWorkload`). */
export interface ReportWorkload {
  userId: ID;
  name: string;
  initials: string;
  open: number;
  done: number;
  total: number;
  percent: number;
}

/** The whole reports payload (GraphQL `Reports`). */
export interface WorkspaceReports {
  completedPerDay: ReportPoint[];
  byStatus: ReportSlice[];
  workload: ReportWorkload[];
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
}

/** Status keys the report donut keeps a slice colour for. */
export type ReportStatusKey = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/** Response data of the `reports` query. */
export interface ReportsData {
  reports: WorkspaceReports;
}

/**
 * One headline counter in the `ReportsView` summary row.
 *
 * `value` is already formatted for display (counts stay numbers, the completion
 * rate arrives as `"42%"`), so the view only has to render it.
 */
export interface ReportStat {
  label: string;
  value: string | number;
}
