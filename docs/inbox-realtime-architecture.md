# Inbox — realtime chat architecture

Goal: an in-app Inbox where a user can chat with any teammate, continue old
conversations (WhatsApp-style), get realtime delivery, in-app notifications and
SMS alerts — with a full API, no external infrastructure.

## Pieces

### 1. Data (Postgres, migration `008_chat.sql`)
- `conversations` — one row per chat (`kind` = `direct` today, `group` later),
  `team_id` scopes it to a workspace, `last_message_at` drives inbox ordering.
- `conversation_members` — membership + per-member `last_read_at` (gives unread
  counts and read state without extra tables).
- `messages` — ordered by `created_at`, indexed by `(conversation_id, created_at)`.
- Functions: `ensure_direct_conversation` (idempotent 1:1 chat = continues old
  threads), `list_conversations` (inbox + peer + last message + unread count),
  `conversation_messages(..., p_after)` (incremental fetch), `send_message`,
  `mark_conversation_read`, `message_recipients` (notification/SMS fan-out).

### 2. Realtime transport — "internal socket"
No external broker. An **in-process pub/sub hub** in the Go server:
- `internal/realtime.Hub`: per-user Go channels; `Publish/PublishTo(userIDs, event)`
  and `Subscribe(userID) <-chan Event`. Events are small structs
  (`MessageEvent` → `{type, conversationId, message}`).
- Exposed to the browser at **`GET /api/v1/events`** (`internal/server/events.go`)
  as **Server-Sent Events** — plain JSON, stdlib only, no new dependency. Auth
  uses the bearer token via `?token=` (EventSource can't set headers) or the
  `Authorization` header. Heartbeat comment every 25s keeps proxies open.
- **Fallback**: the same data is reachable with plain queries, so the client
  polls `conversationMessages` / `conversations` every few seconds if SSE is
  unavailable (proxies, older browsers). The UI is identical.

Flow of a message:
`sendMessage` mutation → insert row → `Hub.PublishTo` the members → their open
SSE stream emits `event: message` → the React Query caches are patched
(`modules/chat/realtime.js`) → the thread and unread badges update instantly.
Independently, the mutation also creates an **in-app notification** and enqueues
an **SMS alert** (existing `notif.Worker`/Mnotify) for the recipients.

### 3. API (GraphQL)
```graphql
type Conversation { id teamId kind peer: User lastMessage: Message unreadCount: Int! updatedAt: Time! }
type Message { id conversationId sender: User body createdAt }

query { conversations: [Conversation!]! }
query { conversationMessages(conversationId: UUID!, after: Time, limit: Int): [Message!]! }

mutation { startConversation(memberId: UUID!): Conversation! }   # find-or-create 1:1
mutation { sendMessage(conversationId: UUID!, body: String!): Message! }
mutation { markConversationRead(conversationId: UUID!): Boolean! }

subscription { messageReceived: MessageEvent! }                  # SSE
```
All resolvers are membership-checked against the caller (`currentUser`).

### 4. Frontend (Inbox view)
- **Two-pane chat**: left = conversation list (teammates, last message, unread
  badge, search); right = open thread with message bubbles (own vs theirs),
  timestamps, day separators, and a composer (Enter to send).
- **Start a chat**: pick any team member from `myTeam` → `startConversation`
  (returns the existing thread if there is one, so old conversations continue).
- **Realtime**: one `EventSource` subscription invalidates/patches the React
  Query caches; polling fallback keeps it working elsewhere.
- **Read state**: opening a thread calls `markConversationRead`; unread badges
  clear and the sender's read state updates.
- Reuses the existing glass design system (panels, bubbles as `glass-tile`s,
  segmented filters, Radix selects) so the Inbox matches the rest of the app.

### 5. Notifications & SMS alerts
- New message → `create_notification(kind: 'message')` for recipients (shows in
  the bell + Dashboard activity).
- If a recipient has no open stream (offline), the same mutation enqueues an SMS
  via `notif.Worker` ("New message from <name>: <preview>"), so they're alerted.

## Build order
1. ✅ DB migration (conversations/members/messages + functions).
2. Go store + GraphQL schema/resolvers for list/messages/send/read/start.
3. `internal/realtime` hub + SSE subscription wiring + notifications/SMS fan-out.
4. Frontend Inbox chat UI + hooks + realtime/polling + tests.
