import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ReportStatusKey, ReportsData, WorkspaceReports } from "../../types/reports";

export const REPORTS_KEY: readonly string[] = ["reports"];

const reportsQuery = `
  query {
    reports {
      completedPerDay { label value }
      byStatus { key label count percent }
      workload { userId name initials open done total percent }
      totalTasks
      completedTasks
      overdueTasks
      completionRate
    }
  }
`;

/** Query options callers may override (e.g. to disable a fetch). */
type ReportsQueryOptions = Partial<
  UseQueryOptions<WorkspaceReports | null, Error, WorkspaceReports | null>
>;

export function useReports(options: ReportsQueryOptions = {}) {
  return useQuery<WorkspaceReports | null>({
    queryKey: REPORTS_KEY,
    queryFn: async (): Promise<WorkspaceReports | null> => {
      const res = await gql<ReportsData>(reportsQuery);
      return res?.data?.reports ?? null;
    },
    retry: false,
    ...options,
  });
}

// Slice colours for the status donut/legend (kept in sync with the board tones).
export const STATUS_COLOR: Record<ReportStatusKey, string> = {
  TODO: "#a1a1aa",
  IN_PROGRESS: "#0ea5e9",
  REVIEW: "#f59e0b",
  DONE: "#10b981",
};
