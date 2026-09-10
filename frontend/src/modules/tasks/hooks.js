import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import { TEAM_KEY } from "../invite/hooks";

export const TASKS_KEY = ["teamTasks"];

const taskFields = `
  id
  teamId
  title
  description
  status
  priority
  dueAt
  startDate
  endDate
  completedAt
  createdAt
  updatedAt
  createdBy { id phone firstName surname }
  assignee { id phone firstName surname }
`;

const taskResult = `
  success
  message
  task {
    ${taskFields}
  }
`;

export function useTeamTasks(options = {}) {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const res = await gql(`query { teamTasks { ${taskFields} } }`);
      return res?.data?.teamTasks ?? [];
    },
    retry: false,
    // Other people reassign and move cards, so a cached list would keep showing
    // the previous assignee: refetch whenever the view mounts or refocuses.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    ...options,
  });
}

// patchTask replaces one task in the cached list, leaving the rest untouched.
function patchTask(tasks, taskId, patch) {
  return tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
}

/**
 * Wraps a task mutation with an optimistic cache update so card edits (moving a
 * card, reassigning, saving the edit form) land in the UI immediately instead of
 * waiting for the round trip.
 *
 * - onMutate: cancels in-flight refetches (so a stale response cannot clobber
 *   the optimistic state), snapshots the list, then applies the patch.
 * - onError: restores the snapshot — a failed call puts the card back where it
 *   was, so the UI never shows a change the server rejected.
 * - onSettled: refetches so the cache ends up matching the server.
 *
 * `optimistic(variables, { tasks, queryClient })` must return the next task
 * list. Mutations without it behave exactly as before.
 */
function useTaskMutation(mutationDoc, { optimistic } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(mutationDoc, variables),
    onMutate: async (variables) => {
      if (!optimistic) return undefined;
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      if (Array.isArray(previous)) {
        const next = optimistic(variables, { tasks: previous, queryClient });
        if (Array.isArray(next)) queryClient.setQueryData(TASKS_KEY, next);
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context && context.previous !== undefined) {
        queryClient.setQueryData(TASKS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
      // My tasks and the dashboard read the same tasks through other queries, so
      // an edit here must not leave them showing the previous assignee.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    },
  });
}

export function useCreateTask() {
  return useTaskMutation(`
    mutation ($input: CreateTaskInput!) {
      createTask(input: $input) { ${taskResult} }
    }
  `);
}

export function useAssignTask() {
  return useTaskMutation(
    `
    mutation ($taskId: UUID!, $assigneeId: UUID) {
      assignTask(taskId: $taskId, assigneeId: $assigneeId) { ${taskResult} }
    }
  `,
    {
      // Reassign instantly using the roster already in the cache; a null
      // assigneeId (unassign) clears the avatar straight away.
      optimistic: ({ taskId, assigneeId }, { tasks, queryClient }) => {
        const team = queryClient.getQueryData(TEAM_KEY);
        const member = (team?.members ?? []).find((m) => m.id === assigneeId);
        const assignee = member
          ? {
              id: member.id,
              phone: member.phone,
              firstName: member.firstName,
              surname: member.surname,
            }
          : null;
        return patchTask(tasks, taskId, { assignee });
      },
    },
  );
}

export function useSetTaskStatus() {
  return useTaskMutation(
    `
    mutation ($taskId: UUID!, $status: TaskStatus!) {
      setTaskStatus(taskId: $taskId, status: $status) { ${taskResult} }
    }
  `,
    {
      // The card hops to its new column before the request resolves.
      optimistic: ({ taskId, status }, { tasks }) =>
        patchTask(tasks, taskId, { status: toApiStatus(status) }),
    },
  );
}

export function useUpdateTaskDescription() {
  return useTaskMutation(`
    mutation ($taskId: UUID!, $description: String!) {
      updateTaskDescription(taskId: $taskId, description: $description) { ${taskResult} }
    }
  `);
}

export function useUpdateTask() {
  return useTaskMutation(
    `
    mutation ($taskId: UUID!, $input: UpdateTaskInput!) {
      updateTask(taskId: $taskId, input: $input) { ${taskResult} }
    }
  `,
    {
      // Mirror the edit form (title/description/priority/status) right away;
      // date fields are left to the refetch since they need normalising.
      optimistic: ({ taskId, input }, { tasks }) => {
        const patch = {};
        if (input.title !== undefined && input.title !== null) patch.title = input.title;
        if (input.description !== undefined && input.description !== null) {
          patch.description = input.description;
        }
        if (input.priority) patch.priority = String(input.priority).toUpperCase();
        if (input.status) patch.status = toApiStatus(input.status);
        return patchTask(tasks, taskId, patch);
      },
    },
  );
}

export function toApiStatus(dbStatus) {
  return String(dbStatus || "TODO").toUpperCase();
}
