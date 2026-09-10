/**
 * Chat / inbox types — the 1:1 conversations between team members.
 *
 * Mirrors the GraphQL `Conversation` and `Message` types, plus the wire shape
 * the server pushes on its SSE stream (`internal/realtime.MessageEvent`) that
 * `modules/chat/realtime.ts` patches into the React Query caches.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString, User } from "./common";

/** Conversation kinds the backend stores; unknown strings are passed through. */
export type ConversationKind = "direct" | "group" | (string & {});

/** The trimmed user projection the chat queries select for a peer/sender. */
export type ChatPerson = Pick<User, "id" | "firstName" | "surname" | "phone">;

/** One message inside a conversation (GraphQL `Message`). */
export interface ChatMessage {
  id: ID;
  /**
   * Set on thread and send responses; the inbox's trimmed `lastMessage`
   * selection deliberately leaves it out.
   */
  conversationId?: ID;
  body: string;
  createdAt: ISODateString;
  sender: ChatPerson;
}

/** One conversation as listed in the inbox (GraphQL `Conversation`). */
export interface ChatConversation {
  id: ID;
  teamId: ID;
  kind: ConversationKind;
  /** The other member of the conversation. */
  peer: ChatPerson | null;
  lastMessage: ChatMessage | null;
  lastMessageAt: ISODateString;
  unreadCount: number;
}

/** One message as delivered on the SSE wire (`realtime.MessagePayload`). */
export interface ChatEventMessage {
  id: ID;
  conversationId: ID;
  senderId: ID;
  senderFirstName: string;
  senderSurname: string;
  body: string;
  createdAt: ISODateString;
}

/** Envelope of an SSE event (`realtime.MessageEvent`). */
export interface ChatMessageEvent {
  /** Event kind — `"message"` today, but the client never branches on it. */
  type?: string;
  conversationId: ID;
  message: ChatEventMessage;
}

/** Response data of the `conversations` query. */
export interface ConversationsData {
  conversations: ChatConversation[];
}

/** Response data of the `conversationMessages` query. */
export interface ConversationMessagesData {
  conversationMessages: ChatMessage[];
}

/** Response data of the `startConversation` mutation. */
export interface StartConversationData {
  startConversation: ChatConversation;
}

/** Response data of the `sendMessage` mutation. */
export interface SendMessageData {
  sendMessage: ChatMessage;
}

/** Response data of the `markConversationRead` mutation. */
export interface MarkConversationReadData {
  markConversationRead: boolean;
}

/** Variables of the `conversationMessages` query. */
export interface ConversationMessagesVariables extends GqlVariables {
  id: ID;
}

/** Variables of the `startConversation` mutation. */
export interface StartConversationVariables extends GqlVariables {
  memberId: ID;
}

/** Variables of the `sendMessage` mutation. */
export interface SendMessageVariables extends GqlVariables {
  conversationId: ID;
  body: string;
}

/** Variables of the `markConversationRead` mutation. */
export interface MarkConversationReadVariables extends GqlVariables {
  id: ID;
}
