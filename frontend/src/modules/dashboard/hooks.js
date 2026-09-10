import { useQuery } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const DASHBOARD_KEY = ["dashboard"];

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

export function useDashboard(options = {}) {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: async () => {
      const res = await gql(dashboardQuery);
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
