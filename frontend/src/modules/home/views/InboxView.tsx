import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { errorMessage } from "../../../lib/errors";
import {
  PaperPlaneIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  ArrowLeftIcon,
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
import type { ID, ISODateString } from "../../../types/common";
import type {
  ChatConversation,
  InboxRow,
  InboxThreadProps,
} from "../../../types/chat";
import type { PersonNameFields } from "../../../types/home";

function nameOf(user?: PersonNameFields | null): string {
  if (!user) return "Unknown";
  return `${user.firstName ?? ""} ${user.surname ?? ""}`.trim() || "Teammate";
}

function initialsOf(user?: PersonNameFields | null): string {
  if (!user) return "?";
  return `${user.firstName?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase() || "?";
}

function timeAgo(iso?: ISODateString | null): string {
  if (!iso) return "";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function dayKey(iso: ISODateString): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function clockTime(iso: ISODateString): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function InboxView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: team } = useMyTeam();
  const { data: conversations = [], isLoading } = useConversations({ enabled: !!user?.id });
  const startConversation = useStartConversation();
  const markRead = useMarkConversationRead();

  const [activeId, setActiveId] = useState<ID | null>(null);
  const [search, setSearch] = useState<string>("");

  const members = team?.members ?? [];
  const active = conversations.find((c) => c.id === activeId) || null;

  // peer id -> existing conversation, so picking a teammate we already talk to
  // opens that thread instead of creating a duplicate conversation.
  const conversationByPeer = useMemo<Map<ID, ChatConversation>>(() => {
    const map = new Map<ID, ChatConversation>();
    for (const c of conversations) {
      if (c.peer?.id) map.set(c.peer.id, c);
    }
    return map;
  }, [conversations]);

  const otherMembers = members.filter((m) => m.id !== user?.id);

  // One row per teammate: their existing chat if there is one, otherwise a row
  // that starts a fresh chat. No "new chat" button or picker modal needed.
  const rows = useMemo<InboxRow[]>(() => {
    const listed = new Set<ID>();
    const out: InboxRow[] = [];
    for (const c of conversations) {
      if (c.peer?.id) listed.add(c.peer.id);
      out.push({ member: c.peer, conv: c });
    }
    for (const m of otherMembers) {
      if (!listed.has(m.id)) out.push({ member: m, conv: null });
    }
    const q = search.trim().toLowerCase();
    if (!q) return out;
    return out.filter((r) => nameOf(r.member).toLowerCase().includes(q));
  }, [conversations, otherMembers, search]);

  function openConversation(id: ID): void {
    setActiveId(id);
    markRead.mutate(id);
  }

  // Picking a teammate: continue the existing chat if there is one, otherwise
  // create it (startConversation is idempotent server-side too).
  function pickMember(memberId?: ID | null): void {
    if (!memberId || memberId === "__pick") return;

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
      onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
    });
  }

  return (
    <div>
      <ViewHeader title="Inbox" subtitle="Chat with your teammates in real time." />

      <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Panel className={`h-fit ${active ? "hidden lg:block" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold t-ink">Chats</h2>
            <span className="badge badge-tint px-2 py-0.5 text-xs">{rows.length}</span>
          </div>

          <div className="relative mt-3">
            <MagnifyingGlassIcon
              width={14}
              height={14}
              className="t-faint absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="control w-full rounded-full py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <ul className="divide-soft mt-3 max-h-[26rem] overflow-y-auto">
            {rows.map(({ member, conv }) => (
              <li key={member?.id ?? conv?.id}>
                <button
                  type="button"
                  onClick={() => (conv ? openConversation(conv.id) : pickMember(member?.id))}
                  aria-label={
                    conv ? `Continue chat with ${nameOf(member)}` : `Start chat with ${nameOf(member)}`
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors ${
                    conv?.id === activeId ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--glass-b)]"
                  }`}
                >
                  <Avatar initial={initialsOf(member)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium t-ink">{nameOf(member)}</p>
                    <p className="truncate text-xs t-soft">
                      {conv ? conv.lastMessage?.body || "No messages yet" : member?.phone}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {conv ? (
                      <span className="text-[11px] t-faint">{timeAgo(conv.lastMessageAt)}</span>
                    ) : (
                      <span className="badge tone-indigo px-2 py-0.5 text-xs">New</span>
                    )}
                    {conv && conv.unreadCount > 0 && (
                      <span
                        aria-label={`${conv.unreadCount} unread messages`}
                        className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-500 px-1 text-[10px] font-semibold text-white"
                      >
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {!isLoading && rows.length === 0 && (
              <li className="px-2 py-8 text-center text-sm t-soft">
                {otherMembers.length === 0
                  ? "No teammates yet — invite someone from the Invite page."
                  : "No teammates match your search."}
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

    </div>
  );
}

function Thread({ conversation, currentUser, onBack }: InboxThreadProps) {
  const toast = useToast();
  const { data: messages = [], isLoading } = useConversationMessages(conversation.id);
  const sendMessage = useSendMessage(conversation.id);
  const [draft, setDraft] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  function submit(e?: FormEvent<HTMLFormElement>): void {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    sendMessage.mutate(body, {
      onError: (err) => {
        toast.error(errorMessage(err, "Something went wrong"));
        setDraft(body);
      },
    });
  }

  let lastDay: string | null = null;

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
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
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
