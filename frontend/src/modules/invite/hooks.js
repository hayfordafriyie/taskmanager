import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const TEAM_KEY = ["myTeam"];
export const INVITES_KEY = ["myInvites"];

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
  return useQuery({
    queryKey: TEAM_KEY,
    queryFn: async () => {
      const res = await gql(`query { myTeam { ${teamFields} } }`);
      return res?.data?.myTeam;
    },
    retry: false,
  });
}

export function useMyInvites() {
  return useQuery({
    queryKey: INVITES_KEY,
    queryFn: async () => {
      const res = await gql(`query { myInvites { ${inviteFields} } }`);
      return res?.data?.myInvites ?? [];
    },
    retry: false,
  });
}

export function useInviteToTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, role }) =>
      gql(
        `mutation ($phone: String!, $role: Role!) {
          inviteToTeam(phone: $phone, role: $role) {
            success message inviteeRegistered alreadyMember invite { id phone role teamName }
          }
        }`,
        { phone, role },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId) =>
      gql(
        `mutation ($inviteId: UUID!) {
          acceptInvite(inviteId: $inviteId) {
            success message team { id name role }
          }
        }`,
        { inviteId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVITES_KEY });
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId) =>
      gql(
        `mutation ($inviteId: UUID!) {
          revokeInvite(inviteId: $inviteId)
        }`,
        { inviteId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}