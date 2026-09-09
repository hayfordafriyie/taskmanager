import { useState } from "react";
import { PaperPlaneIcon, PersonIcon, ClockIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PolicyBadge, Avatar } from "../ui";
import { useToast } from "../../../components/Toast";
import {
  useMyTeam,
  useMyInvites,
  useInviteToTeam,
  useAcceptInvite,
  useRevokeInvite,
} from "../../invite/hooks";

const roleOptions = ["ADMIN", "MEMBER", "GUEST"];

const roleLabel = {
  ADMIN: "Admin",
  MEMBER: "Member",
  GUEST: "Guest",
};

function nameOf(member) {
  return `${member?.firstName ?? ""} ${member?.surname ?? ""}`.trim() || "Member";
}

function initialsOf(candidate) {
  if (candidate?.invitedBy) {
    return `${candidate.invitedBy.firstName?.[0] ?? ""}${candidate.invitedBy.surname?.[0] ?? ""}`.toUpperCase();
  }
  return `${candidate?.firstName?.[0] ?? ""}${candidate?.surname?.[0] ?? ""}`.toUpperCase() || "U";
}

function shortDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InviteView() {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("MEMBER");

  const { data: team, isPending, isError, error } = useMyTeam();
  const { data: invites, isPending: invitesPending } = useMyInvites();
  const inviteToTeam = useInviteToTeam();
  const acceptInvite = useAcceptInvite();
  const revokeInvite = useRevokeInvite();

  async function handleInvite(e) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Enter a phone number to invite.");
      return;
    }
    try {
      const res = await inviteToTeam.mutateAsync({ phone: phone.trim(), role });
      const result = res?.data?.inviteToTeam;
      if (result?.success) {
        toast.success(result.message);
        setPhone("");
      } else {
        toast.error(result?.message || "Unable to send the invitation.");
      }
    } catch (err) {
      toast.error(err?.message || "Unable to send the invitation.");
    }
  }

  async function handleAccept(id) {
    try {
      const res = await acceptInvite.mutateAsync(id);
      const result = res?.data?.acceptInvite;
      if (result?.success) {
        toast.success(result.message);
      } else {
        toast.error(result?.message || "Unable to accept the invitation.");
      }
    } catch (err) {
      toast.error(err?.message || "Unable to accept the invitation.");
    }
  }

  async function handleRevoke(id) {
    try {
      const res = await revokeInvite.mutateAsync(id);
      if (res?.data?.revokeInvite) {
        toast.success("Invitation revoked.");
      } else {
        toast.error("This invitation could not be revoked.");
      }
    } catch (err) {
      toast.error(err?.message || "Unable to revoke the invitation.");
    }
  }

  if (isPending) {
    return (
      <div>
        <ViewHeader title="Invite" subtitle="Loading your workspace…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <ViewHeader title="Invite" subtitle={error?.message || "Could not load your workspace."} />
      </div>
    );
  }

  const members = team?.members ?? [];
  const pendingInvites = team?.invites ?? [];

  return (
    <div>
      <ViewHeader title="Invite" subtitle="Bring teammates into your workspace." />

      {invitesPending ? null : invites?.length > 0 ? (
        <Panel className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <header className="flex items-center gap-2">
            <ClockIcon width={16} height={16} className="text-amber-600 dark:text-amber-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Invitations for you
            </h2>
          </header>
          <ul className="mt-3 space-y-3">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center dark:border-amber-900 dark:bg-zinc-900"
              >
                <Avatar initial={initialsOf(invite)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {invite.teamName}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Invited by {nameOf(invite.invitedBy)} · {shortDate(invite.createdAt)}
                  </p>
                </div>
                <PolicyBadge tone={roleLabel[invite.role]}>{roleLabel[invite.role]}</PolicyBadge>
                <button
                  type="button"
                  onClick={() => handleAccept(invite.id)}
                  disabled={acceptInvite.isPending}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel>
          <header className="flex items-center gap-2">
            <PaperPlaneIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Invite people
            </h2>
          </header>
          <form onSubmit={handleInvite} className="mt-3 space-y-3">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233541230000"
              aria-label="Phone number"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    role === r
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {roleLabel[r]}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={inviteToTeam.isPending}
              className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Send invite
            </button>
          </form>
          {pendingInvites.length > 0 && (
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              {pendingInvites.length} pending invitation{pendingInvites.length === 1 ? "" : "s"}.
            </p>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <header className="flex items-center gap-2">
            <PersonIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Members ({members.length})
            </h2>
          </header>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar initial={initialsOf(m)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {nameOf(m)}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {m.phone}
                  </p>
                </div>
                <PolicyBadge tone={roleLabel[m.role]}>{roleLabel[m.role]}</PolicyBadge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {pendingInvites.length > 0 && (
        <Panel className="mt-4">
          <header className="flex items-center gap-2">
            <PaperPlaneIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Pending invites
            </h2>
          </header>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {invite.phone}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Invited by {nameOf(invite.invitedBy)} · {shortDate(invite.createdAt)}
                  </p>
                </div>
                <PolicyBadge tone={roleLabel[invite.role]}>{roleLabel[invite.role]}</PolicyBadge>
                <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
                <button
                  type="button"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokeInvite.isPending}
                  aria-label={`Revoke invite for ${invite.phone}`}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}