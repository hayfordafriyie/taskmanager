import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const timeEntriesKey = (from, to) => ["timeEntries", from, to];
export const timeSummaryKey = (from, to) => ["timeSummary", from, to];

const entryFields = `
  id
  userId
  taskId
  taskTitle
  label
  minutes
  spentOn
  note
  createdAt
`;

// The API's Time scalar is RFC3339, so date-only values are converted.
export function toApiTime(date) {
  if (!date) return null;
  if (typeof date === "string") {
    return date.includes("T") ? date : `${date}T00:00:00.000Z`;
  }
  return date.toISOString();
}

export function useTimeEntries(from, to, options = {}) {
  return useQuery({
    queryKey: timeEntriesKey(from, to),
    enabled: !!from && !!to,
    queryFn: async () => {
      const res = await gql(
        `query ($from: Time!, $to: Time!) {
           timeEntries(from: $from, to: $to) { ${entryFields} }
         }`,
        { from: toApiTime(from), to: toApiTime(to) },
      );
      return res?.data?.timeEntries ?? [];
    },
    retry: false,
    ...options,
  });
}

export function useTimeSummary(from, to, options = {}) {
  return useQuery({
    queryKey: timeSummaryKey(from, to),
    enabled: !!from && !!to,
    queryFn: async () => {
      const res = await gql(
        `query ($from: Time!, $to: Time!) {
           timeSummary(from: $from, to: $to) {
             totalMinutes entryCount activeDays topLabel topMinutes
           }
         }`,
        { from: toApiTime(from), to: toApiTime(to) },
      );
      return res?.data?.timeSummary ?? null;
    },
    retry: false,
    ...options,
  });
}

function useTimeMutation(doc) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      queryClient.invalidateQueries({ queryKey: ["timeSummary"] });
    },
  });
}

export function useLogTime() {
  return useTimeMutation(`
    mutation ($input: LogTimeInput!) {
      logTime(input: $input) {
        success
        message
        entry { ${entryFields} }
      }
    }
  `);
}

export function useDeleteTimeEntry() {
  return useTimeMutation(`
    mutation ($entryId: UUID!) { deleteTimeEntry(entryId: $entryId) }
  `);
}

export function formatHours(minutes) {
  const hours = (Number(minutes) || 0) / 60;
  return `${hours.toFixed(1)}h`;
}
