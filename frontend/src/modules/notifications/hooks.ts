import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient, UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type {
  AppNotification,
  NotificationIdVariables,
  NotificationMutationData,
  NotificationsData,
  UnreadNotificationCountData,
} from "../../types/notifications";

export const NOTIFICATIONS_KEY: readonly string[] = ["notifications"];
export const UNREAD_KEY: readonly string[] = ["unreadNotificationCount"];

const notificationFields = `
  id
  kind
  title
  body
  taskId
  read
  createdAt
`;

function invalidateNotifications(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
}

/** Query options callers may override (e.g. to disable a fetch). */
type NotificationsQueryOptions = Partial<
  UseQueryOptions<AppNotification[], Error, AppNotification[]>
>;
type UnreadQueryOptions = Partial<UseQueryOptions<number, Error, number>>;

export function useNotifications(options: NotificationsQueryOptions = {}) {
  return useQuery<AppNotification[]>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async (): Promise<AppNotification[]> => {
      const res = await gql<NotificationsData>(
        `query { notifications { ${notificationFields} } }`,
      );
      return res?.data?.notifications ?? [];
    },
    retry: false,
    ...options,
  });
}

export function useUnreadNotificationCount(options: UnreadQueryOptions = {}) {
  return useQuery<number>({
    queryKey: UNREAD_KEY,
    queryFn: async (): Promise<number> => {
      const res = await gql<UnreadNotificationCountData>(
        "query { unreadNotificationCount }",
      );
      return Number(res?.data?.unreadNotificationCount ?? 0);
    },
    retry: false,
    ...options,
  });
}

function useNotificationMutation(mutationDoc: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, NotificationIdVariables | undefined>({
    mutationFn: (variables?: NotificationIdVariables) =>
      gql<NotificationMutationData>(mutationDoc, variables),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

export function useMarkNotificationRead() {
  return useNotificationMutation(`
    mutation ($id: UUID!) { markNotificationRead(id: $id) }
  `);
}

export function useMarkNotificationUnread() {
  return useNotificationMutation(`
    mutation ($id: UUID!) { markNotificationUnread(id: $id) }
  `);
}

export function useMarkAllNotificationsRead() {
  return useNotificationMutation("mutation { markAllNotificationsRead }");
}

export function useMarkAllNotificationsUnread() {
  return useNotificationMutation("mutation { markAllNotificationsUnread }");
}

export function useDeleteNotification() {
  return useNotificationMutation(`
    mutation ($id: UUID!) { deleteNotification(id: $id) }
  `);
}

export function useDeleteAllNotifications() {
  return useNotificationMutation("mutation { deleteAllNotifications }");
}
