/**
 * Goal types — objectives and key results (`GoalsView`).
 *
 * Mirrors the GraphQL `Goal`, `KeyResult`, `GoalStatus` and `CreateGoalInput`
 * types, plus the variable/response shapes the goal hooks use.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString, User } from "./common";

/** Goal lifecycle, mirroring the GraphQL `GoalStatus` enum. */
export type GoalStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "DONE";

/** One key result measured under a goal. */
export interface KeyResult {
  id: ID;
  title: string;
  /** Completion percentage, 0–100. */
  progress: number;
  createdAt: ISODateString;
}

/** A goal as returned by `teamGoals`. */
export interface Goal {
  id: ID;
  teamId: ID;
  title: string;
  description: string;
  status: GoalStatus;
  dueAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  owner: User;
  /** Rolled-up completion percentage, 0–100. */
  progress: number;
  keyResults: KeyResult[];
}

/** Result of every goal mutation (mirrors the GraphQL `GoalResult`). */
export interface GoalResult {
  success: boolean;
  message: string;
  goal?: Goal | null;
}

/** Input object of `createGoal` (GraphQL `CreateGoalInput`). */
export interface CreateGoalInput {
  title: string;
  description?: string;
  status?: GoalStatus;
  dueAt?: ISODateString | null;
  ownerId?: ID | null;
}

/** Response data of the `teamGoals` query. */
export interface TeamGoalsData {
  teamGoals: Goal[];
}

/** Response data of every goal mutation (only one key is present). */
export interface GoalMutationData {
  createGoal?: GoalResult;
  updateGoalStatus?: GoalResult;
  createKeyResult?: GoalResult;
  setKeyResultProgress?: GoalResult;
  deleteGoal?: boolean;
}

/** Variables of the `createGoal` mutation. */
export interface CreateGoalVariables extends GqlVariables {
  input: CreateGoalInput;
}

/** Variables of the `updateGoalStatus` mutation. */
export interface UpdateGoalStatusVariables extends GqlVariables {
  goalId: ID;
  status: GoalStatus;
}

/** Variables of the `createKeyResult` mutation. */
export interface CreateKeyResultVariables extends GqlVariables {
  goalId: ID;
  title: string;
}

/** Variables of the `setKeyResultProgress` mutation. */
export interface SetKeyResultProgressVariables extends GqlVariables {
  keyResultId: ID;
  progress: number;
}

/** Variables of the `deleteGoal` mutation. */
export interface GoalIdVariables extends GqlVariables {
  goalId: ID;
}

/** One entry of the goal-status picker. */
export interface GoalStatusOption {
  value: GoalStatus;
  label: string;
}
