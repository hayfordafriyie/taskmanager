import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../../lib/api";

export const DOCS_KEY = ["teamDocs"];
export const docAccessKey = (docId) => ["docAccess", docId];

const docFields = `
  id
  teamId
  title
  body
  visibility
  createdAt
  updatedAt
  canEdit
  accessCount
  createdBy { id firstName surname }
`;

const docResult = `
  success
  message
  doc { ${docFields} }
`;

export const VISIBILITY_OPTIONS = [
  { value: "TEAM", label: "Whole team" },
  { value: "RESTRICTED", label: "Restricted (invite only)" },
  { value: "PRIVATE", label: "Private (just me)" },
];

export const VISIBILITY_LABEL = {
  TEAM: "Team",
  RESTRICTED: "Restricted",
  PRIVATE: "Private",
};

export const VISIBILITY_TONE = {
  TEAM: "tone-indigo",
  RESTRICTED: "tone-amber",
  PRIVATE: "tone-neutral",
};

export function useTeamDocs(options = {}) {
  return useQuery({
    queryKey: DOCS_KEY,
    queryFn: async () => {
      const res = await gql(`query { teamDocs { ${docFields} } }`);
      return res?.data?.teamDocs ?? [];
    },
    retry: false,
    ...options,
  });
}

export function useDocAccessList(docId, options = {}) {
  return useQuery({
    queryKey: docAccessKey(docId),
    enabled: !!docId,
    queryFn: async () => {
      const res = await gql(
        `query ($docId: UUID!) {
           docAccessList(docId: $docId) { userId name phone canEdit grantedAt }
         }`,
        { docId },
      );
      return res?.data?.docAccessList ?? [];
    },
    retry: false,
    ...options,
  });
}

function useDocMutation(doc) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => gql(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: ["docAccess"] });
    },
  });
}

export function useCreateDoc() {
  return useDocMutation(`
    mutation ($title: String!, $body: String, $visibility: DocVisibility) {
      createDoc(title: $title, body: $body, visibility: $visibility) { ${docResult} }
    }
  `);
}

export function useUpdateDoc() {
  return useDocMutation(`
    mutation ($docId: UUID!, $title: String, $body: String, $visibility: DocVisibility) {
      updateDoc(docId: $docId, title: $title, body: $body, visibility: $visibility) { ${docResult} }
    }
  `);
}

export function useDeleteDoc() {
  return useDocMutation(`
    mutation ($docId: UUID!) { deleteDoc(docId: $docId) }
  `);
}

export function useSetDocAccess() {
  return useDocMutation(`
    mutation ($docId: UUID!, $userId: UUID!, $canEdit: Boolean) {
      setDocAccess(docId: $docId, userId: $userId, canEdit: $canEdit) { ${docResult} }
    }
  `);
}

export function useRevokeDocAccess() {
  return useDocMutation(`
    mutation ($docId: UUID!, $userId: UUID!) {
      revokeDocAccess(docId: $docId, userId: $userId)
    }
  `);
}
