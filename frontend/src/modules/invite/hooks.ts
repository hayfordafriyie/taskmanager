import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ApiResponse } from "../../types/api";
import type {
  AcceptInviteData,
  InviteIdVariables,
  InviteToTeamData,
  InviteToTeamVariables,
  MyInvitesData,
  MyTeamData,
  MyTeamsData,
  RevokeInviteData,
  SwitchTeamData,
  SwitchTeamVariables,
  Team,
  TeamInvite,
  TeamSummary,
} from "../../types/invite";

export const TEAM_KEY: readonly string[] = ["myTeam"];
export const INVITES_KEY: readonly string[] = ["myInvites"];
export const TEAMS_KEY: readonly string[] = ["myTeams"];

const teamFields = `
  id
  name
  role
  members { id phone firstName surname role createdAt }
  invites { id phone role status teamName invitedBy { id firstName surname } createdAt expiresAt }
`;

const inviteFields = `
  id
  phone
  role
  status
  teamName
  invitedBy { id firstName surname }
  createdAt
  expiresAt
`;

export function useMyTeam() {
  return useQuery<Team | null | undefined>({
    queryKey: TEAM_KEY,
    queryFn: async (): Promise<Team | null | undefined> => {
      const res = await gql<MyTeamData>(
        `query { myTeam { ${teamFields} } }`,
      );
      return res?.data?.myTeam;
    },
    retry: false,
  });
}

export function useMyInvites() {
  return useQuery<TeamInvite[]>({
    queryKey: INVITES_KEY,
    queryFn: async (): Promise<TeamInvite[]> => {
      const res = await gql<MyInvitesData>(
        `query { myInvites { ${inviteFields} } }`,
      );
      return res?.data?.myInvites ?? [];
    },
    retry: false,
  });
}

export function useInviteToTeam() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<InviteToTeamData>, Error, InviteToTeamVariables>({
    mutationFn: (variables: InviteToTeamVariables) =>
      gql<InviteToTeamData>(
        `mutation ($phone: String!, $role: Role!) {
          inviteToTeam(phone: $phone, role: $role) {
            success message inviteeRegistered alreadyMember invite { id phone role teamName }
          }
        }`,
        variables,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<AcceptInviteData>, Error, string>({
    mutationFn: (inviteId: string) =>
      gql<AcceptInviteData>(
        `mutation ($inviteId: UUID!) {
          acceptInvite(inviteId: $inviteId) {
            success message team { id name role }
          }
        }`,
        { inviteId } satisfies InviteIdVariables,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVITES_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<RevokeInviteData>, Error, string>({
    mutationFn: (inviteId: string) =>
      gql<RevokeInviteData>(
        `mutation ($inviteId: UUID!) {
          revokeInvite(inviteId: $inviteId)
        }`,
        { inviteId } satisfies InviteIdVariables,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useMyTeams() {
  return useQuery<TeamSummary[]>({
    queryKey: TEAMS_KEY,
    queryFn: async (): Promise<TeamSummary[]> => {
      const res = await gql<MyTeamsData>(
        `query { myTeams { id name role isOwner isActive memberCount ownerName } }`,
      );
      return res?.data?.myTeams ?? [];
    },
    retry: false,
  });
}

export function useSwitchTeam() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<SwitchTeamData>, Error, string>({
    mutationFn: (teamId: string) =>
      gql<SwitchTeamData>(
        `mutation ($teamId: UUID!) {
          switchTeam(teamId: $teamId) {
            success message team { id name role }
          }
        }`,
        { teamId } satisfies SwitchTeamVariables,
      ),
    onSuccess: (res) => {
      const payload = res?.data?.switchTeam;
      if (!payload || payload.success === false) return;

      // Update the active-workspace handshake first: the shell keys its whole
      // subtree on this team id, so it remounts once (not twice) and every view
      // refetches straight away — no page refresh, no data from the old team.
      if (payload.team) {
        const switched = payload.team;
        queryClient.setQueryData<Team | null | undefined>(
          ["myTeam"],
          (prev) => (prev ? { ...prev, ...switched } : prev),
        );
      }
      // Drop everything else so nothing team-scoped can linger in memory.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "myTeam",
      });
      queryClient.invalidateQueries();
    },
  });
}
