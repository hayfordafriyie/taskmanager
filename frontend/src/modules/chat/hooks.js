import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import { TEAM_KEY } from "../invite/hooks";

export const CONVERSATIONS_KEY = ["conversations"];
export const messagesKey = (conversationId) => ["conversationMessages", conversationId];

// Poll intervals give the "internal socket" realtime feel without a broker.
// The Go side also exposes an SSE subscription; polling is the always-works
// baseline (proxies, older browsers).
const INBOX_POLL_MS = 5000;
const THREAD_POLL_MS = 3000;

const messageFields = `
  id
  conversationId
  body
  createdAt
  sender { id firstName surname }
`;

const conversationFields = `
  id
  teamId
  kind
  unreadCount
  lastMessageAt
  peer { id firstName surname phone }
  lastMessage { id body createdAt sender { id firstName surname } }
`;

export function useConversations(options = {}) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async () => {
      const res = await gql(`query { conversations { ${conversationFields} } }`);
      return res?.data?.conversations ?? [];
    },
    refetchInterval: INBOX_POLL_MS,
    retry: false,
    ...options,
  });
}

export function useConversationMessages(conversationId, options = {}) {
  return useQuery({
    queryKey: messagesKey(conversationId),
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await gql(
        `query ($id: UUID!) { conversationMessages(conversationId: $id, limit: 200) { ${messageFields} } }`,
        { id: conversationId },
      );
      return res?.data?.conversationMessages ?? [];
    },
    refetchInterval: THREAD_POLL_MS,
    retry: false,
    ...options,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId) =>
      gql(
        `mutation ($memberId: UUID!) {
           startConversation(memberId: $memberId) { ${conversationFields} }
         }`,
        { memberId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useSendMessage(conversationId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      gql(
        `mutation ($conversationId: UUID!, $body: String!) {
           sendMessage(conversationId: $conversationId, body: $body) { ${messageFields} }
         }`,
        { conversationId, body },
      ),
    onSuccess: (res) => {
      const sent = res?.data?.sendMessage;
      if (sent) {
        queryClient.setQueryData(messagesKey(conversationId), (prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.some((m) => m.id === sent.id)) return list;
          return [...list, sent];
        });
      }
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId) =>
      gql(
        `mutation ($id: UUID!) { markConversationRead(conversationId: $id) }`,
        { id: conversationId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
