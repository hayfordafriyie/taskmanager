# Goals APIs — design

Goals are workspace-scoped OKRs: a goal has an owner (a member) and zero or more
key results. **A goal's progress is the average of its key results**, computed on
read, so check-ins always show the truth. All operations are membership-checked.

## Data (migration `009_goals.sql`)
- `goals` — `team_id`, `created_by`, `owner_id`, `title`, `description`,
  `status` (`on_track` | `at_risk` | `behind` | `done`), `due_at`, timestamps.
- `key_results` — `goal_id`, `title`, `progress` (0–100).
- Functions: `create_goal`, `goals_for_team` (owner + progress + KR count),
  `goal_key_results`, `create_key_result`, `set_key_result_progress`,
  `update_goal_status`, `delete_goal`, plus `goal_team` for permission checks.

## GraphQL
```graphql
enum GoalStatus { ON_TRACK AT_RISK BEHIND DONE }

type KeyResult { id: UUID! title: String! progress: Int! createdAt: Time! }

type Goal {
  id: UUID!
  teamId: UUID!
  title: String!
  description: String!
  status: GoalStatus!
  dueAt: Time
  createdAt: Time!
  updatedAt: Time!
  owner: User!
  progress: Int!          # average of key results
  keyResults: [KeyResult!]!
}

input CreateGoalInput {
  title: String!
  description: String = ""
  status: GoalStatus = ON_TRACK
  dueAt: Time
  ownerId: UUID
}

type GoalResult { success: Boolean! message: String! goal: Goal }

query {
  teamGoals: [Goal!]!
}

mutation {
  createGoal(input: CreateGoalInput!): GoalResult!
  updateGoalStatus(goalId: UUID!, status: GoalStatus!): GoalResult!
  createKeyResult(goalId: UUID!, title: String!): GoalResult!
  setKeyResultProgress(keyResultId: UUID!, progress: Int!): GoalResult!
  deleteGoal(goalId: UUID!): Boolean!
}
```

## Frontend
- `modules/goals/hooks.js`: `useTeamGoals`, `useCreateGoal`, `useUpdateGoalStatus`,
  `useCreateKeyResult`, `useSetKeyResultProgress`, `useDeleteGoal`.
- `GoalsView`: real goal cards (progress ring from `progress`, owner, status badge),
  a **New goal** modal (title/description/owner via Radix select/status/due date),
  a **status** control per card, key-result rows with a **progress control**
  (check-in), and delete. Keeps the existing glass design.
