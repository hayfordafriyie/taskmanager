/**
 * Workspace, team and invite types.
 *
 * A user always owns one private workspace and may belong to other teams, so
 * the header switcher works with the lighter `TeamSummary` while the invite
 * screen reads the full `Team`.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString, Role, TeamMember } from "./common";
import type { PersonNameFields } from "./home";

/**
 * Lifecycle of an invitation.
 *
 * Lowercase on purpose: `graph/schema.resolvers.go` sets
 * `invite.Status = "pending"` and migration 002 constrains the column to
 * `('pending', 'accepted', 'revoked')`.
 */
export type InviteStatus = "pending" | "accepted" | "revoked";

/** The member who sent an invitation. */
export interface InviteSender {
  id: ID;
  firstName: string;
  surname: string;
}

/** One invitation to join a workspace. */
export interface TeamInvite {
  id: ID;
  teamName: string;
  phone: string;
  role: Role;
  status: InviteStatus;
  invitedBy: InviteSender;
  expiresAt: ISODateString;
  createdAt: ISODateString;
}

/** A workspace with its members and pending invites. */
export interface Team {
  id: ID;
  name: string;
  role: Role;
  members: TeamMember[];
  invites: TeamInvite[];
}

/** A workspace as listed by the switcher. */
export interface TeamSummary {
  id: ID;
  name: string;
  role: Role;
  isOwner: boolean;
  isActive: boolean;
  memberCount: number;
  ownerName?: string | null;
}

/** Result of `inviteToTeam`. */
export interface InviteToTeamResult {
  success: boolean;
  message: string;
  invite?: TeamInvite | null;
  inviteeRegistered: boolean;
  alreadyMember: boolean;
}

/** Result of `acceptInvite`. */
export interface AcceptInviteResult {
  success: boolean;
  message: string;
  team?: Team | null;
}

/** Result of `switchTeam`. */
export interface SwitchTeamResult {
  success: boolean;
  message: string;
  team?: Team | null;
}

/** Response data of the `myTeam` query. */
export interface MyTeamData {
  myTeam?: Team | null;
}

/** Response data of the `myInvites` query. */
export interface MyInvitesData {
  myInvites: TeamInvite[];
}

/** Response data of the `myTeams` query. */
export interface MyTeamsData {
  myTeams: TeamSummary[];
}

/** Variables of `inviteToTeam`. */
export interface InviteToTeamVariables extends GqlVariables {
  phone: string;
  role: Role;
}

/** Variables of `acceptInvite` and `revokeInvite`. */
export interface InviteIdVariables extends GqlVariables {
  inviteId: ID;
}

/** Variables of `switchTeam`. */
export interface SwitchTeamVariables extends GqlVariables {
  teamId: ID;
}

/** Response data of the `myTeam` mutation family. */
export interface InviteToTeamData {
  inviteToTeam: InviteToTeamResult;
}

/** Response data of the `acceptInvite` mutation. */
export interface AcceptInviteData {
  acceptInvite: AcceptInviteResult;
}

/** Response data of the `revokeInvite` mutation. */
export interface RevokeInviteData {
  revokeInvite: boolean;
}

/** Response data of the `switchTeam` mutation. */
export interface SwitchTeamData {
  switchTeam: SwitchTeamResult;
}

/**
 * Anything the invite screen renders as an avatar: an invitation (whose
 * initials come from the inviter) or a workspace member.
 *
 * The name fields are optional because an invitation carries no name of its
 * own, so `initialsOf` falls back to "U" for one whose inviter was not sent.
 */
export interface InviteAvatarSource extends PersonNameFields {
  invitedBy?: InviteSender | null;
}
