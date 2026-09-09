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

  async function handleResend(invite) {
    try {
      const res = await inviteToTeam.mutateAsync({
        phone: invite.phone,
        role: invite.role,
      });
      const result = res?.data?.inviteToTeam;
      if (result?.success) {
        toast.success("Invitation resent.");
      } else {
        toast.error(result?.message || "Unable to resend the invitation.");
      }
    } catch (err) {
      toast.error(err?.message || "Unable to resend the invitation.");
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
        <Panel className="mt-6">
          <header className="flex items-center gap-2">
            <ClockIcon width={16} height={16} className="text-amber-600 dark:text-amber-500" />
            <h2 className="font-display text-sm font-semibold t-ink">
              Invitations for you
            </h2>
          </header>
          <ul className="mt-3 space-y-3">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="glass-tile flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
              >
                <Avatar initial={initialsOf(invite)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium t-ink">
                    {invite.teamName}
                  </p>
                  <p className="truncate text-xs t-soft">
                    Invited by {nameOf(invite.invitedBy)} · {shortDate(invite.createdAt)}
                  </p>
                </div>
                <PolicyBadge tone={roleLabel[invite.role]}>{roleLabel[invite.role]}</PolicyBadge>
                <button
                  type="button"
                  onClick={() => handleAccept(invite.id)}
                  disabled={acceptInvite.isPending}
                  className="btn-gloss-primary rounded-full px-3.5 py-2 text-sm"
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
            <PaperPlaneIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">
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
              className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
            />
            <div className="seg flex-wrap">
              {roleOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className="seg-btn"
                >
                  {roleLabel[r]}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={inviteToTeam.isPending}
              className="btn-gloss-primary w-full rounded-full px-3.5 py-2.5 text-sm"
            >
              Send invite
            </button>
          </form>
          {pendingInvites.length > 0 && (
            <p className="mt-3 text-xs t-faint">
              {pendingInvites.length} pending invitation{pendingInvites.length === 1 ? "" : "s"}.
            </p>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <header className="flex items-center gap-2">
            <PersonIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">
              Members ({members.length})
            </h2>
          </header>
          <ul className="divide-soft mt-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar initial={initialsOf(m)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium t-ink">
                    {nameOf(m)}
                  </p>
                  <p className="truncate text-xs t-soft">
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
            <PaperPlaneIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">
              Pending invites
            </h2>
          </header>
          <ul className="divide-soft mt-3">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium t-ink">
                    {invite.phone}
                  </p>
                  <p className="truncate text-xs t-soft">
                    Invited by {nameOf(invite.invitedBy)} · {shortDate(invite.createdAt)}
                  </p>
                </div>
                <PolicyBadge tone={roleLabel[invite.role]}>{roleLabel[invite.role]}</PolicyBadge>
                <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
                <button
                  type="button"
                  onClick={() => handleResend(invite)}
                  disabled={inviteToTeam.isPending}
                  aria-label={`Resend invite to ${invite.phone}`}
                  className="accent-text ring-accent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--accent-tint)] disabled:opacity-50"
                >
                  Resend
                </button>
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