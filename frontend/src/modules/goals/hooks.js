import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import { TEAM_KEY } from "../invite/hooks";

export const GOALS_KEY = ["teamGoals"];

const keyResultFields = `
  id
  title
  progress
  createdAt
`;

const goalFields = `
  id
  teamId
  title
  description
  status
  dueAt
  createdAt
  updatedAt
  progress
  owner { id firstName surname phone }
  keyResults { ${keyResultFields} }
`;

const goalResult = `
  success
  message
  goal { ${goalFields} }
`;

export function useTeamGoals(options = {}) {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: async () => {
      const res = await gql(`query { teamGoals { ${goalFields} } }`);
      return res?.data?.teamGoals ?? [];
    },
    retry: false,
    ...options,
  });
}

function useGoalMutation(doc) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useCreateGoal() {
  return useGoalMutation(`
    mutation ($input: CreateGoalInput!) {
      createGoal(input: $input) { ${goalResult} }
    }
  `);
}

export function useUpdateGoalStatus() {
  return useGoalMutation(`
    mutation ($goalId: UUID!, $status: GoalStatus!) {
      updateGoalStatus(goalId: $goalId, status: $status) { ${goalResult} }
    }
  `);
}

export function useCreateKeyResult() {
  return useGoalMutation(`
    mutation ($goalId: UUID!, $title: String!) {
      createKeyResult(goalId: $goalId, title: $title) { ${goalResult} }
    }
  `);
}

export function useSetKeyResultProgress() {
  return useGoalMutation(`
    mutation ($keyResultId: UUID!, $progress: Int!) {
      setKeyResultProgress(keyResultId: $keyResultId, progress: $progress) { ${goalResult} }
    }
  `);
}

export function useDeleteGoal() {
  return useGoalMutation(`
    mutation ($goalId: UUID!) { deleteGoal(goalId: $goalId) }
  `);
}

// UI labels <-> API enum values (ON_TRACK / AT_RISK / BEHIND / DONE).
export const GOAL_STATUS_LABEL = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BEHIND: "Behind",
  DONE: "Done",
};

export const GOAL_STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "On track" },
  { value: "AT_RISK", label: "At risk" },
  { value: "BEHIND", label: "Behind" },
  { value: "DONE", label: "Done" },
];
