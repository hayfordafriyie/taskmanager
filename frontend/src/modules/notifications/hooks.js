import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const NOTIFICATIONS_KEY = ["notifications"];
export const UNREAD_KEY = ["unreadNotificationCount"];

const notificationFields = `
  id
  kind
  title
  body
  taskId
  read
  createdAt
`;

function invalidateNotifications(queryClient) {
  queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
}

export function useNotifications(options = {}) {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const res = await gql(`query { notifications { ${notificationFields} } }`);
      return res?.data?.notifications ?? [];
    },
    retry: false,
    ...options,
  });
}

export function useUnreadNotificationCount(options = {}) {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const res = await gql("query { unreadNotificationCount }");
      return Number(res?.data?.unreadNotificationCount ?? 0);
    },
    retry: false,
    ...options,
  });
}

function useNotificationMutation(mutationDoc) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(mutationDoc, variables),
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
