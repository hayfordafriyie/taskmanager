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
    ...options,
  });
}

function useTaskMutation(mutationDoc) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(mutationDoc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
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
  return useTaskMutation(`
    mutation ($taskId: UUID!, $assigneeId: UUID) {
      assignTask(taskId: $taskId, assigneeId: $assigneeId) { ${taskResult} }
    }
  `);
}

export function useSetTaskStatus() {
  return useTaskMutation(`
    mutation ($taskId: UUID!, $status: TaskStatus!) {
      setTaskStatus(taskId: $taskId, status: $status) { ${taskResult} }
    }
  `);
}

export function useUpdateTaskDescription() {
  return useTaskMutation(`
    mutation ($taskId: UUID!, $description: String!) {
      updateTaskDescription(taskId: $taskId, description: $description) { ${taskResult} }
    }
  `);
}

export function useUpdateTask() {
  return useTaskMutation(`
    mutation ($taskId: UUID!, $input: UpdateTaskInput!) {
      updateTask(taskId: $taskId, input: $input) { ${taskResult} }
    }
  `);
}

export function toApiStatus(dbStatus) {
  return String(dbStatus || "TODO").toUpperCase();
}
