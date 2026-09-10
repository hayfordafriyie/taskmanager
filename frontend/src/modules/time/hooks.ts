import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ApiResponse, GqlVariables } from "../../types/api";
import type {
  DeleteTimeEntryData,
  DeleteTimeEntryVariables,
  LogTimeData,
  LogTimeVariables,
  TimeEntriesData,
  TimeEntry,
  TimeInput,
  TimeSummary,
  TimeSummaryData,
} from "../../types/time";

export const timeEntriesKey = (from: TimeInput, to: TimeInput): readonly unknown[] => [
  "timeEntries",
  from,
  to,
];
export const timeSummaryKey = (from: TimeInput, to: TimeInput): readonly unknown[] => [
  "timeSummary",
  from,
  to,
];

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

/** Query options callers may override (e.g. to disable a fetch). */
type TimeEntriesQueryOptions = Partial<
  UseQueryOptions<TimeEntry[], Error, TimeEntry[]>
>;
type TimeSummaryQueryOptions = Partial<
  UseQueryOptions<TimeSummary | null, Error, TimeSummary | null>
>;

// The API's Time scalar is RFC3339, so date-only values are converted.
export function toApiTime(date: TimeInput): string | null {
  if (!date) return null;
  if (typeof date === "string") {
    return date.includes("T") ? date : `${date}T00:00:00.000Z`;
  }
  return date.toISOString();
}

export function useTimeEntries(
  from: TimeInput,
  to: TimeInput,
  options: TimeEntriesQueryOptions = {},
) {
  return useQuery<TimeEntry[]>({
    queryKey: timeEntriesKey(from, to),
    enabled: !!from && !!to,
    queryFn: async (): Promise<TimeEntry[]> => {
      const res = await gql<TimeEntriesData>(
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

export function useTimeSummary(
  from: TimeInput,
  to: TimeInput,
  options: TimeSummaryQueryOptions = {},
) {
  return useQuery<TimeSummary | null>({
    queryKey: timeSummaryKey(from, to),
    enabled: !!from && !!to,
    queryFn: async (): Promise<TimeSummary | null> => {
      const res = await gql<TimeSummaryData>(
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

function useTimeMutation<TData, TVariables extends GqlVariables>(doc: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<TData>, Error, TVariables>({
    mutationFn: (variables: TVariables) => gql<TData>(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      queryClient.invalidateQueries({ queryKey: ["timeSummary"] });
    },
  });
}

export function useLogTime() {
  return useTimeMutation<LogTimeData, LogTimeVariables>(`
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
  return useTimeMutation<DeleteTimeEntryData, DeleteTimeEntryVariables>(`
    mutation ($entryId: UUID!) { deleteTimeEntry(entryId: $entryId) }
  `);
}

export function formatHours(minutes: number): string {
  const hours = (Number(minutes) || 0) / 60;
  return `${hours.toFixed(1)}h`;
}
