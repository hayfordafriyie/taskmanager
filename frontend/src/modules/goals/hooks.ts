import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ApiResponse, GqlVariables } from "../../types/api";
import type {
  CreateGoalVariables,
  CreateKeyResultVariables,
  Goal,
  GoalIdVariables,
  GoalMutationData,
  GoalStatus,
  GoalStatusOption,
  SetKeyResultProgressVariables,
  TeamGoalsData,
  UpdateGoalStatusVariables,
} from "../../types/goals";
import { TEAM_KEY } from "../invite/hooks";

export const GOALS_KEY: readonly string[] = ["teamGoals"];

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

/** Query options callers may override (e.g. to disable a fetch). */
type GoalsQueryOptions = Partial<UseQueryOptions<Goal[], Error, Goal[]>>;

export function useTeamGoals(options: GoalsQueryOptions = {}) {
  return useQuery<Goal[]>({
    queryKey: GOALS_KEY,
    queryFn: async (): Promise<Goal[]> => {
      const res = await gql<TeamGoalsData>(`query { teamGoals { ${goalFields} } }`);
      return res?.data?.teamGoals ?? [];
    },
    retry: false,
    ...options,
  });
}

function useGoalMutation<TVariables extends GqlVariables>(doc: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<GoalMutationData>, Error, TVariables>({
    mutationFn: (variables: TVariables) => gql<GoalMutationData>(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useCreateGoal() {
  return useGoalMutation<CreateGoalVariables>(`
    mutation ($input: CreateGoalInput!) {
      createGoal(input: $input) { ${goalResult} }
    }
  `);
}

export function useUpdateGoalStatus() {
  return useGoalMutation<UpdateGoalStatusVariables>(`
    mutation ($goalId: UUID!, $status: GoalStatus!) {
      updateGoalStatus(goalId: $goalId, status: $status) { ${goalResult} }
    }
  `);
}

export function useCreateKeyResult() {
  return useGoalMutation<CreateKeyResultVariables>(`
    mutation ($goalId: UUID!, $title: String!) {
      createKeyResult(goalId: $goalId, title: $title) { ${goalResult} }
    }
  `);
}

export function useSetKeyResultProgress() {
  return useGoalMutation<SetKeyResultProgressVariables>(`
    mutation ($keyResultId: UUID!, $progress: Int!) {
      setKeyResultProgress(keyResultId: $keyResultId, progress: $progress) { ${goalResult} }
    }
  `);
}

export function useDeleteGoal() {
  return useGoalMutation<GoalIdVariables>(`
    mutation ($goalId: UUID!) { deleteGoal(goalId: $goalId) }
  `);
}

// UI labels <-> API enum values (ON_TRACK / AT_RISK / BEHIND / DONE).
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BEHIND: "Behind",
  DONE: "Done",
};

export const GOAL_STATUS_OPTIONS: GoalStatusOption[] = [
  { value: "ON_TRACK", label: "On track" },
  { value: "AT_RISK", label: "At risk" },
  { value: "BEHIND", label: "Behind" },
  { value: "DONE", label: "Done" },
];
