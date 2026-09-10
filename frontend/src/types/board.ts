/**
 * Types for the board and My-tasks views (`modules/home/views/BoardView`,
 * `modules/home/views/MyTasksView`).
 *
 * The task entity itself lives in `./tasks`; everything here is view-local:
 * the board's column definitions, the entries of its assignee select, the
 * props of its draggable card, the priority label map the card and the
 * My-tasks row both use, and the My-tasks segmented filter.
 */
import type { ID, TeamMember } from "./common";
import type { Priority, Task, TaskStatus } from "./tasks";
import type { SelectOption } from "./ui";

/** One status column of the board. */
export interface BoardColumn {
  /** The (API) status whose tasks this column collects. */
  key: TaskStatus;
  /** Label rendered in the column header. */
  label: string;
  /** Tailwind class of the status dot. */
  dot: string;
  /** Tailwind class of the header label. */
  tint: string;
}

/**
 * An entry of the board's assignee select: a plain `SelectOption` that also
 * carries the member it was built from, so a row can render a compact chip.
 */
export interface BoardAssigneeOption extends SelectOption<string> {
  member: TeamMember | null;
}

/**
 * An `[id, member]` pair — the roster is deduped by id before it reaches the
 * assignee select, and `Map` is built from these pairs.
 */
export type MemberEntry = [ID, TeamMember];

/** Props of the board's draggable task card. */
export interface BoardTaskCardProps {
  task: Task;
  /** The workspace roster, used to build the card's assignee options. */
  members: TeamMember[];
  /** Id of the card currently being dragged (`null` when none is). */
  dragId: ID | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onStatus: (status: TaskStatus) => void;
  /** Empty string unassigns the task. */
  onAssignee: (memberId: string) => void;
}

/** Priority → display label, shared by the board card and the My-tasks row. */
export type PriorityLabelMap = Record<Priority, string>;

/** The My-tasks segmented filter. */
export type MyTasksFilter = "All" | "Open" | "Done";
