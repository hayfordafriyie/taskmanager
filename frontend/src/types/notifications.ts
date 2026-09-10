/**
 * Notification types — the in-app notification centre (bell, list, badges).
 *
 * Mirrors the GraphQL `Notification` type plus the small payloads the
 * notification mutations return.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString } from "./common";

/** Kinds the backend currently emits; unknown strings are passed through. */
export type NotificationKind = "task_due_soon" | "task_assigned" | (string & {});

/** One notification shown in the bell panel. */
export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /** Task the notification refers to, when it has one. */
  taskId?: ID | null;
  read: boolean;
  createdAt: ISODateString;
}

/** Response data of the `notifications` query. */
export interface NotificationsData {
  notifications: AppNotification[];
}

/** Response data of the `unreadNotificationCount` query. */
export interface UnreadNotificationCountData {
  unreadNotificationCount: number;
}

/** Variables accepted by the per-notification mutations. */
export interface NotificationIdVariables extends GqlVariables {
  id: ID;
}

/** Response data of every notification mutation (only one key is present). */
export interface NotificationMutationData {
  markNotificationRead?: boolean;
  markNotificationUnread?: boolean;
  markAllNotificationsRead?: boolean;
  markAllNotificationsUnread?: boolean;
  deleteNotification?: boolean;
  deleteAllNotifications?: boolean;
}
