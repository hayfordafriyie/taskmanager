import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EVENTS_ENDPOINT, getAccessToken } from "../../lib/api";
import type { ChatEventMessage, ChatMessage, ChatMessageEvent } from "../../types/chat";
import { CONVERSATIONS_KEY, messagesKey } from "./hooks";

const NOTIFICATIONS_KEY: readonly string[] = ["notifications"];
const UNREAD_KEY: readonly string[] = ["unreadNotificationCount"];

/**
 * Narrow an untrusted parsed SSE body to the chat event envelope. Bodies come
 * off the wire as `unknown`; anything that is not an object carrying a
 * conversation id and a message (other event kinds, malformed frames) is
 * dropped.
 */
function toChatMessageEvent(value: unknown): ChatMessageEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Partial<ChatMessageEvent>;
  if (!event.conversationId || !event.message) return null;
  return { conversationId: event.conversationId, message: event.message };
}

/** Build the cache row for a message that arrived over SSE. */
function toChatMessage(conversationId: string, message: ChatEventMessage): ChatMessage {
  return {
    id: message.id,
    conversationId,
    body: message.body,
    createdAt: message.createdAt,
    sender: {
      id: message.senderId,
      firstName: message.senderFirstName,
      surname: message.senderSurname,
    },
  };
}

/** Open the SSE connection, or `null` when the browser cannot (jsdom). */
function openSource(token: string): EventSource | null {
  try {
    return new EventSource(`${EVENTS_ENDPOINT}?token=${encodeURIComponent(token)}`);
  } catch {
    return null;
  }
}

// useChatRealtime subscribes to the server's internal SSE event stream and
// patches the React Query caches as events arrive. This is the push path; the
// hooks also poll, so the UI still works if SSE is unavailable.
export function useChatRealtime(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof EventSource === "undefined") return undefined; // jsdom / old browsers

    const token = getAccessToken();
    if (!token) return undefined;

    const source = openSource(token);
    if (!source) return undefined;

    function onMessage(event: MessageEvent): void {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const chatEvent = toChatMessageEvent(data);
      if (chatEvent) {
        const { conversationId, message } = chatEvent;
        queryClient.setQueryData<ChatMessage[]>(messagesKey(conversationId), (prev) => {
          const list = Array.isArray(prev) ? prev : null;
          if (!list) return prev; // thread not open/subscribed yet
          if (list.some((m) => m.id === message.id)) return list;
          return [...list, toChatMessage(conversationId, message)];
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
