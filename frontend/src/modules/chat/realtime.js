import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EVENTS_ENDPOINT, getAccessToken } from "../../lib/api";
import { CONVERSATIONS_KEY, messagesKey } from "./hooks";

const NOTIFICATIONS_KEY = ["notifications"];
const UNREAD_KEY = ["unreadNotificationCount"];

// useChatRealtime subscribes to the server's internal SSE event stream and
// patches the React Query caches as events arrive. This is the push path; the
// hooks also poll, so the UI still works if SSE is unavailable.
export function useChatRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof EventSource === "undefined") return undefined; // jsdom / old browsers

    const token = getAccessToken();
    if (!token) return undefined;

    let source;
    try {
      source = new EventSource(`${EVENTS_ENDPOINT}?token=${encodeURIComponent(token)}`);
    } catch {
      return undefined;
    }

    function onMessage(event) {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const conversationId = data?.conversationId;
      const message = data?.message;
      if (conversationId && message) {
        queryClient.setQueryData(messagesKey(conversationId), (prev) => {
          const list = Array.isArray(prev) ? prev : null;
          if (!list) return prev; // thread not open/subscribed yet
          if (list.some((m) => m.id === message.id)) return list;
          return [
            ...list,
            {
              id: message.id,
              conversationId,
              body: message.body,
              createdAt: message.createdAt,
              sender: {
                id: message.senderId,
                firstName: message.senderFirstName,
                surname: message.senderSurname,
              },
            },
          ];
        });
      }
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    }

    source.addEventListener("message", onMessage);
    return () => {
      source.removeEventListener("message", onMessage);
      source.close();
    };
  }, [enabled, queryClient]);
}
