import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { gql } from "../../lib/api";
import type { ApiResponse, GqlVariables } from "../../types/api";
import type { ID } from "../../types/common";
import type {
  CreateDocVariables,
  Doc,
  DocAccess,
  DocAccessListData,
  DocAccessQueryVariables,
  DocIdVariables,
  DocMutationData,
  DocVisibility,
  DocVisibilityOption,
  RevokeDocAccessVariables,
  SetDocAccessVariables,
  TeamDocsData,
  UpdateDocVariables,
} from "../../types/docs";

export const DOCS_KEY: readonly string[] = ["teamDocs"];
export const docAccessKey = (docId: ID): readonly [string, ID] => ["docAccess", docId];

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

/** Query options callers may override (e.g. to disable a fetch). */
type DocsQueryOptions = Partial<UseQueryOptions<Doc[], Error, Doc[]>>;
type DocAccessQueryOptions = Partial<UseQueryOptions<DocAccess[], Error, DocAccess[]>>;

export const VISIBILITY_OPTIONS: DocVisibilityOption[] = [
  { value: "TEAM", label: "Whole team" },
  { value: "RESTRICTED", label: "Restricted (invite only)" },
  { value: "PRIVATE", label: "Private (just me)" },
];

export const VISIBILITY_LABEL: Record<DocVisibility, string> = {
  TEAM: "Team",
  RESTRICTED: "Restricted",
  PRIVATE: "Private",
};

export const VISIBILITY_TONE: Record<DocVisibility, string> = {
  TEAM: "tone-indigo",
  RESTRICTED: "tone-amber",
  PRIVATE: "tone-neutral",
};

export function useTeamDocs(options: DocsQueryOptions = {}) {
  return useQuery<Doc[]>({
    queryKey: DOCS_KEY,
    queryFn: async (): Promise<Doc[]> => {
      const res = await gql<TeamDocsData>(`query { teamDocs { ${docFields} } }`);
      return res?.data?.teamDocs ?? [];
    },
    retry: false,
    ...options,
  });
}

export function useDocAccessList(docId: ID, options: DocAccessQueryOptions = {}) {
  return useQuery<DocAccess[]>({
    queryKey: docAccessKey(docId),
    enabled: !!docId,
    queryFn: async (): Promise<DocAccess[]> => {
      const res = await gql<DocAccessListData>(
        `query ($docId: UUID!) {
           docAccessList(docId: $docId) { userId name phone canEdit grantedAt }
         }`,
        { docId } satisfies DocAccessQueryVariables,
      );
      return res?.data?.docAccessList ?? [];
    },
    retry: false,
    ...options,
  });
}

function useDocMutation<TVariables extends GqlVariables>(doc: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<DocMutationData>, Error, TVariables>({
    mutationFn: (variables: TVariables) => gql<DocMutationData>(doc, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: ["docAccess"] });
    },
  });
}

export function useCreateDoc() {
  return useDocMutation<CreateDocVariables>(`
    mutation ($title: String!, $body: String, $visibility: DocVisibility) {
      createDoc(title: $title, body: $body, visibility: $visibility) { ${docResult} }
    }
  `);
}

export function useUpdateDoc() {
  return useDocMutation<UpdateDocVariables>(`
    mutation ($docId: UUID!, $title: String, $body: String, $visibility: DocVisibility) {
      updateDoc(docId: $docId, title: $title, body: $body, visibility: $visibility) { ${docResult} }
    }
  `);
}

export function useDeleteDoc() {
  return useDocMutation<DocIdVariables>(`
    mutation ($docId: UUID!) { deleteDoc(docId: $docId) }
  `);
}

export function useSetDocAccess() {
  return useDocMutation<SetDocAccessVariables>(`
    mutation ($docId: UUID!, $userId: UUID!, $canEdit: Boolean) {
      setDocAccess(docId: $docId, userId: $userId, canEdit: $canEdit) { ${docResult} }
    }
  `);
}

export function useRevokeDocAccess() {
  return useDocMutation<RevokeDocAccessVariables>(`
    mutation ($docId: UUID!, $userId: UUID!) {
      revokeDocAccess(docId: $docId, userId: $userId)
    }
  `);
}
