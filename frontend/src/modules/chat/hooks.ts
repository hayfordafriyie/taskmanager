import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ApiResponse } from "../../types/api";
import type { ID } from "../../types/common";
import type {
  ChatConversation,
  ChatMessage,
  ConversationsData,
  ConversationMessagesData,
  MarkConversationReadData,
  MarkConversationReadVariables,
  SendMessageData,
  SendMessageVariables,
  StartConversationData,
  StartConversationVariables,
} from "../../types/chat";
import { TEAM_KEY } from "../invite/hooks";

export const CONVERSATIONS_KEY: readonly string[] = ["conversations"];
/** Cache key of one conversation thread (id may still be unknown). */
export const messagesKey = (
  conversationId: ID | null | undefined,
): readonly unknown[] => ["conversationMessages", conversationId];

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

/** Query options callers may override (e.g. to disable a fetch). */
type ConversationsQueryOptions = Partial<
  UseQueryOptions<ChatConversation[], Error, ChatConversation[]>
>;
type MessagesQueryOptions = Partial<
  UseQueryOptions<ChatMessage[], Error, ChatMessage[]>
>;

export function useConversations(options: ConversationsQueryOptions = {}) {
  return useQuery<ChatConversation[]>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async (): Promise<ChatConversation[]> => {
      const res = await gql<ConversationsData>(
        `query { conversations { ${conversationFields} } }`,
      );
      return res?.data?.conversations ?? [];
    },
    refetchInterval: INBOX_POLL_MS,
    retry: false,
    ...options,
  });
}

export function useConversationMessages(
  conversationId: ID | null | undefined,
  options: MessagesQueryOptions = {},
) {
  return useQuery<ChatMessage[]>({
    queryKey: messagesKey(conversationId),
    enabled: !!conversationId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const res = await gql<ConversationMessagesData>(
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
  return useMutation<ApiResponse<StartConversationData>, Error, ID>({
    mutationFn: (memberId: ID) =>
      gql<StartConversationData>(
        `mutation ($memberId: UUID!) {
           startConversation(memberId: $memberId) { ${conversationFields} }
         }`,
        { memberId } satisfies StartConversationVariables,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useSendMessage(conversationId: ID) {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<SendMessageData>, Error, string>({
    mutationFn: (body: string) =>
      gql<SendMessageData>(
        `mutation ($conversationId: UUID!, $body: String!) {
           sendMessage(conversationId: $conversationId, body: $body) { ${messageFields} }
         }`,
        { conversationId, body } satisfies SendMessageVariables,
      ),
    onSuccess: (res) => {
      const sent = res?.data?.sendMessage;
      if (sent) {
        queryClient.setQueryData<ChatMessage[]>(messagesKey(conversationId), (prev) => {
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
  return useMutation<ApiResponse<MarkConversationReadData>, Error, ID>({
    mutationFn: (conversationId: ID) =>
      gql<MarkConversationReadData>(
        `mutation ($id: UUID!) { markConversationRead(conversationId: $id) }`,
        { id: conversationId } satisfies MarkConversationReadVariables,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
