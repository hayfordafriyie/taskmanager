import { useQuery } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const REPORTS_KEY = ["reports"];

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

export function useReports(options = {}) {
  return useQuery({
    queryKey: REPORTS_KEY,
    queryFn: async () => {
      const res = await gql(reportsQuery);
      return res?.data?.reports ?? null;
    },
    retry: false,
    ...options,
  });
}

// Slice colours for the status donut/legend (kept in sync with the board tones).
export const STATUS_COLOR = {
  TODO: "#a1a1aa",
  IN_PROGRESS: "#0ea5e9",
  REVIEW: "#f59e0b",
  DONE: "#10b981",
};

