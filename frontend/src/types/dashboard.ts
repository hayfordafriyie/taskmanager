/**
 * Dashboard types — the "at a glance" home view.
 *
 * Mirrors the GraphQL `Dashboard` type (stats, upcoming tasks, status
 * breakdown, recent activity and the due-this-week histogram). The task rows
 * are a trimmed `Task` projection: the dashboard query only selects the fields
 * the home cards render, so they get their own shape here instead of the full
 * `Task` entity.
 */
import type { ReactNode } from "react";
import type { ID, ISODateString, User } from "./common";
import type { NotificationKind } from "./notifications";
import type { IconComponent } from "./ui";

/** Task states, mirroring the GraphQL `TaskStatus` enum. */
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/** Task priorities, mirroring the GraphQL `Priority` enum. */
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

/** The trimmed user projection the dashboard's task rows select. */
export type DashboardPerson = Pick<User, "id" | "firstName" | "surname">;

/** Headline counters (GraphQL `DashboardStats`). */
export interface DashboardStats {
  doneToday: number;
  inProgress: number;
  overdue: number;
  completedThisWeek: number;
}

/** One slice of the status breakdown (GraphQL `DashboardSlice`). */
export interface DashboardSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
}

/** One row of the recent-activity feed (GraphQL `DashboardActivity`). */
export interface DashboardActivity {
  id: ID;
  /** Activity is rendered from the user's notifications, so the kinds match. */
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: ISODateString;
}

/** One day of the due-this-week histogram (GraphQL `DashboardDay`). */
export interface DashboardDay {
  /** Short weekday label, e.g. `"Mon"`. */
  day: string;
  /** Human date label, e.g. `"Jan 2"`. */
  label: string;
  count: number;
}

/** An upcoming task row — the fields the dashboard query selects. */
export interface DashboardTask {
  id: ID;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: ISODateString | null;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  assignee: DashboardPerson | null;
  createdBy: DashboardPerson;
}

/** The whole dashboard payload (GraphQL `Dashboard`). */
export interface Dashboard {
  stats: DashboardStats;
  completedToday: number;
  upcomingTasks: DashboardTask[];
  statusBreakdown: DashboardSlice[];
  activity: DashboardActivity[];
  dueThisWeek: DashboardDay[];
}

/** Response data of the `dashboard` query. */
export interface DashboardData {
  dashboard: Dashboard;
}

// ---------------------------------------------------------------------------
// Dashboard view (`modules/home/dashboard`)
// ---------------------------------------------------------------------------

/** One headline counter card in the dashboard's stat grid. */
export interface DashboardStat {
  label: string;
  value: number;
  Icon: IconComponent;
  /** Tailwind text-colour classes applied to the card's icon. */
  tint: string;
}

/** Props of the dashboard's local section header (icon + title row). */
export interface DashboardSectionHeaderProps {
  title: ReactNode;
  icon: IconComponent;
}
