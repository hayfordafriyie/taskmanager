import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { Dashboard, DashboardData } from "../../types/dashboard";

export const DASHBOARD_KEY: readonly string[] = ["dashboard"];

const dashboardQuery = `
  query {
    dashboard {
      stats { doneToday inProgress overdue completedThisWeek }
      completedToday
      upcomingTasks {
        id
        title
        status
        priority
        dueAt
        startDate
        endDate
        assignee { id firstName surname }
        createdBy { id firstName surname }
      }
      statusBreakdown { key label count percent }
      activity { id kind title body createdAt }
      dueThisWeek { day label count }
    }
  }
`;

/** Query options callers may override (e.g. to disable a fetch). */
type DashboardQueryOptions = Partial<
  UseQueryOptions<Dashboard | null, Error, Dashboard | null>
>;

export function useDashboard(options: DashboardQueryOptions = {}) {
  return useQuery<Dashboard | null>({
    queryKey: DASHBOARD_KEY,
    queryFn: async (): Promise<Dashboard | null> => {
      const res = await gql<DashboardData>(dashboardQuery);
      return res?.data?.dashboard ?? null;
    },
    retry: false,
    // Tasks move between people and columns on other devices, so never trust a
    // cached dashboard: refetch whenever the view mounts or regains focus.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    ...options,
  });
}
