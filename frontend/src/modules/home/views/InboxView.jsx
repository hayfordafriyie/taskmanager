import { useEffect, useMemo, useRef, useState } from "react";
import {
  PaperPlaneIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  ArrowLeftIcon,
  PlusIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { Panel, ViewHeader, Avatar } from "../ui";
import { useAuth } from "../../auth/AuthContext";
import { useMyTeam } from "../../invite/hooks";
import {
  useConversations,
  useConversationMessages,
  useStartConversation,
  useSendMessage,
  useMarkConversationRead,
} from "../../chat/hooks";
import { useToast } from "../../../components/Toast";

function nameOf(user) {
  if (!user) return "Unknown";
  return `${user.firstName ?? ""} ${user.surname ?? ""}`.trim() || "Teammate";
}

function initialsOf(user) {
  if (!user) return "?";
  return `${user.firstName?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase() || "?";
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function dayKey(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function clockTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function InboxView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: team } = useMyTeam();
  const { data: conversations = [], isLoading } = useConversations({ enabled: !!user?.id });
  const startConversation = useStartConversation();
  const markRead = useMarkConversationRead();

  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const members = team?.members ?? [];
  const active = conversations.find((c) => c.id === activeId) || null;

  // peer id -> existing conversation, so picking a teammate we already talk to
  // opens that thread instead of creating a duplicate conversation.
  const conversationByPeer = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      if (c.peer?.id) map.set(c.peer.id, c);
    }
    return map;
  }, [conversations]);

  const otherMembers = members.filter((m) => m.id !== user?.id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => nameOf(c.peer).toLowerCase().includes(q));
  }, [conversations, search]);

  function openConversation(id) {
    setActiveId(id);
    markRead.mutate(id);
  }

  // Picking a teammate: continue the existing chat if there is one, otherwise
  // create it (startConversation is idempotent server-side too).
  function pickMember(memberId) {
    if (!memberId || memberId === "__pick") return;
    setShowNew(false);

    const existing = conversationByPeer.get(memberId);
    if (existing) {
      openConversation(existing.id);
      return;
    }

    startConversation.mutate(memberId, {
      onSuccess: (res) => {
        const conv = res?.data?.startConversation;
        if (conv?.id) openConversation(conv.id);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <ViewHeader title="Inbox" subtitle="Chat with your teammates in real time." />

      <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Panel className={`h-fit ${active ? "hidden lg:block" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold t-ink">Chats</h2>
            <div className="flex items-center gap-2">
              <span className="badge badge-tint px-2 py-0.5 text-xs">{conversations.length}</span>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="btn-gloss-primary flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
              >
                <PlusIcon width={12} height={12} />
                New chat
              </button>
            </div>
          </div>

          <div className="relative mt-3">
            <MagnifyingGlassIcon
              width={14}
              height={14}
              className="t-faint absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="control w-full rounded-full py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <ul className="divide-soft mt-3 max-h-[26rem] overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openConversation(c.id)}
                  aria-label={`Open chat with ${nameOf(c.peer)}`}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors ${
                    c.id === activeId ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--glass-b)]"
                  }`}
                >
                  <Avatar initial={initialsOf(c.peer)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium t-ink">{nameOf(c.peer)}</p>
                    <p className="truncate text-xs t-soft">
                      {c.lastMessage?.body || "No messages yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] t-faint">{timeAgo(c.lastMessageAt)}</span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-500 px-1 text-[10px] font-semibold text-white">
                        {c.unreadCount > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {!isLoading && filtered.length === 0 && (
              <li className="px-2 py-8 text-center text-sm t-soft">
                {conversations.length === 0
                  ? "No chats yet — message a teammate to start."
                  : "No chats match your search."}
              </li>
            )}
          </ul>
        </Panel>

        <Panel className={active ? "" : "hidden lg:block"}>
          {active ? (
            <Thread conversation={active} currentUser={user} onBack={() => setActiveId(null)} />
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center gap-2 text-center">
              <PersonIcon width={20} height={20} className="t-faint" />
              <p className="text-sm t-soft">Select a chat to see the conversation.</p>
            </div>
          )}
        </Panel>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass-pop mt-16 w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold t-ink">New chat</h3>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                aria-label="Close new chat"
                className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>
            <p className="mt-1 text-xs t-soft">
              Pick a teammate. If you already chat with them, their existing conversation opens.
            </p>

            {otherMembers.length === 0 ? (
              <p className="py-8 text-center text-sm t-soft">
                No other teammates yet — invite someone from the Invite page.
              </p>
            ) : (
              <ul className="divide-soft mt-3 max-h-[22rem] overflow-y-auto">
                {otherMembers.map((m) => {
                  const existing = conversationByPeer.get(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => pickMember(m.id)}
                        aria-label={
                          existing
                            ? `Continue chat with ${nameOf(m)}`
                            : `Start chat with ${nameOf(m)}`
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[var(--glass-b)]"
                      >
                        <Avatar initial={initialsOf(m)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium t-ink">{nameOf(m)}</p>
                          <p className="truncate text-xs t-soft">{m.phone}</p>
                        </div>
                        <span
                          className={`badge px-2 py-0.5 text-xs ${
                            existing ? "badge-tint" : "tone-indigo"
                          }`}
                        >
                          {existing ? "Open chat" : "New"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Thread({ conversation, currentUser, onBack }) {
  const toast = useToast();
  const { data: messages = [], isLoading } = useConversationMessages(conversation.id);
  const sendMessage = useSendMessage(conversation.id);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  function submit(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    sendMessage.mutate(body, {
      onError: (err) => {
        toast.error(err.message);
        setDraft(body);
      },
    });
  }

  let lastDay = null;

  return (
    <div className="flex min-h-[24rem] flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)] lg:hidden"
        >
          <ArrowLeftIcon width={16} height={16} />
        </button>
        <Avatar initial={initialsOf(conversation.peer)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold t-ink">{nameOf(conversation.peer)}</p>
          <p className="truncate text-xs t-soft">{conversation.peer?.phone}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto py-4" style={{ maxHeight: "26rem" }}>
        {isLoading && messages.length === 0 && (
          <p className="py-8 text-center text-sm t-soft">Loading messages…</p>
        )}
        {messages.map((m) => {
          const mine = m.sender?.id === currentUser?.id;
          const day = dayKey(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <p className="my-3 text-center text-[11px] font-medium t-faint">{day}</p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-[var(--accent)] text-white" : "glass-tile t-ink"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                      {nameOf(m.sender)}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "t-faint"}`}>
                    {clockTime(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-[var(--border-subtle)] pt-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          aria-label="Message"
          className="control max-h-32 min-h-[2.75rem] w-full resize-y rounded-2xl px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || !draft.trim()}
          aria-label="Send message"
          className="btn-gloss-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <PaperPlaneIcon width={16} height={16} />
        </button>
      </form>
    </div>
  );
}

export default InboxView;
