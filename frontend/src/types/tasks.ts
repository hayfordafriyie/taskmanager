/**
 * Task types — the board, my-tasks, calendar and time views.
 *
 * Mirrors the GraphQL `Task`, `TaskStatus`, `Priority`, `CreateTaskInput` and
 * `UpdateTaskInput` types, plus the variable/response shapes the task hooks and
 * the planned-window date helpers use.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString, User } from "./common";

/** Task lifecycle, mirroring the GraphQL `TaskStatus` enum. */
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/** Task priority, mirroring the GraphQL `Priority` enum. */
export type Priority = "LOW" | "MEDIUM" | "HIGH";

/** The date fields a task carries; every one of them is optional in the API. */
export interface TaskDates {
  /** Deadline (`Time` scalar, RFC3339), nullable. */
  dueAt?: ISODateString | null;
  /** Planned window start (`Time` scalar, RFC3339), nullable. */
  startDate?: ISODateString | null;
  /** Planned window end (`Time` scalar, RFC3339), nullable. */
  endDate?: ISODateString | null;
}

/** A task as returned by `teamTasks`. */
export interface Task extends TaskDates {
  id: ID;
  teamId: ID;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  completedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: User;
  assignee?: User | null;
}

/** Result of every task mutation (mirrors the GraphQL `TaskResult`). */
export interface TaskResult {
  success: boolean;
  message: string;
  task?: Task | null;
}

/** Input object of `createTask` (GraphQL `CreateTaskInput`). */
export interface CreateTaskInput extends TaskDates {
  title: string;
  description?: string;
  priority?: Priority;
  assigneeId?: ID | null;
}

/** Input object of `updateTask` (GraphQL `UpdateTaskInput`). */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  assigneeId?: ID | null;
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
  /** Removes the start date instead of leaving it untouched. */
  clearStartDate?: boolean;
  /** Removes the end date instead of leaving it untouched. */
  clearEndDate?: boolean;
}

/** Response data of the `teamTasks` query. */
export interface TeamTasksData {
  teamTasks: Task[];
}

/** Response data of every task mutation (only one key is present). */
export interface TaskMutationData {
  createTask?: TaskResult;
  updateTask?: TaskResult;
  assignTask?: TaskResult;
  setTaskStatus?: TaskResult;
  updateTaskDescription?: TaskResult;
}

/** Variables of the `createTask` mutation. */
export interface CreateTaskVariables extends GqlVariables {
  input: CreateTaskInput;
}

/** Variables of the `updateTask` mutation. */
export interface UpdateTaskVariables extends GqlVariables {
  taskId: ID;
  input: UpdateTaskInput;
}

/** Variables of the `assignTask` mutation (a null `assigneeId` unassigns). */
export interface AssignTaskVariables extends GqlVariables {
  taskId: ID;
  assigneeId?: ID | null;
}

/** Variables of the `setTaskStatus` mutation. */
export interface SetTaskStatusVariables extends GqlVariables {
  taskId: ID;
  status: TaskStatus;
}

/** Variables of the `updateTaskDescription` mutation. */
export interface UpdateTaskDescriptionVariables extends GqlVariables {
  taskId: ID;
  description: string;
}

/** The fields an optimistic cache update is allowed to patch on a task. */
export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "priority" | "status" | "assignee">
>;

/**
 * A date-ish value the planned-window helpers accept: an RFC3339 string from
 * the API, a `Date`, or the empty/null value of an untouched form control.
 */
export type TaskDateInput = string | Date | null | undefined;

/** Arguments of `buildDatePayload`. */
export interface BuildDatePayloadParams {
  /** Value of the start-date input (`YYYY-MM-DD`, or empty). */
  start?: string | null;
  /** Value of the end-date input (`YYYY-MM-DD`, or empty). */
  end?: string | null;
  /** The task being edited, used to decide whether a blanked field is a clear. */
  previous?: TaskDates | null;
  /** True when the payload feeds an update rather than a create. */
  isEdit?: boolean;
}

/** The date portion of a create/update payload built by `buildDatePayload`. */
export interface TaskDatePayload {
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  clearStartDate?: boolean;
  clearEndDate?: boolean;
}
