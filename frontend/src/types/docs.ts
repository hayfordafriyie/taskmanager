/**
 * Document types — shared and personal pages (`DocsView`).
 *
 * Mirrors the GraphQL `Doc`, `DocAccess`, `DocVisibility` and `DocResult`
 * types, plus the variable/response shapes the doc hooks use.
 */
import type { GqlVariables } from "./api";
import type { ID, ISODateString, User } from "./common";

/** Who may open a document, mirroring the GraphQL `DocVisibility` enum. */
export type DocVisibility = "TEAM" | "PRIVATE" | "RESTRICTED";

/** A document as returned by `teamDocs`. */
export interface Doc {
  id: ID;
  teamId: ID;
  title: string;
  body: string;
  visibility: DocVisibility;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: User;
  /** True when the signed-in user may edit this document. */
  canEdit: boolean;
  /** Number of members with an explicit access grant. */
  accessCount: number;
}

/** One explicit access grant, as returned by `docAccessList`. */
export interface DocAccess {
  userId: ID;
  name: string;
  phone: string;
  canEdit: boolean;
  grantedAt: ISODateString;
}

/** Result of every doc mutation that returns a document (`DocResult`). */
export interface DocResult {
  success: boolean;
  message: string;
  doc?: Doc | null;
}

/** Response data of the `teamDocs` query. */
export interface TeamDocsData {
  teamDocs: Doc[];
}

/** Response data of the `docAccessList` query. */
export interface DocAccessListData {
  docAccessList: DocAccess[];
}

/** Response data of every doc mutation (only one key is present). */
export interface DocMutationData {
  createDoc?: DocResult;
  updateDoc?: DocResult;
  deleteDoc?: boolean;
  setDocAccess?: DocResult;
  revokeDocAccess?: boolean;
}

/** Variables of the `docAccessList` query. */
export interface DocAccessQueryVariables extends GqlVariables {
  docId: ID;
}

/** Variables of the `createDoc` mutation. */
export interface CreateDocVariables extends GqlVariables {
  title: string;
  body?: string | null;
  visibility?: DocVisibility | null;
}

/** Variables of the `updateDoc` mutation. */
export interface UpdateDocVariables extends GqlVariables {
  docId: ID;
  title?: string | null;
  body?: string | null;
  visibility?: DocVisibility | null;
}

/** Variables of the `deleteDoc` mutation. */
export interface DocIdVariables extends GqlVariables {
  docId: ID;
}

/** Variables of the `setDocAccess` mutation. */
export interface SetDocAccessVariables extends GqlVariables {
  docId: ID;
  userId: ID;
  canEdit?: boolean | null;
}

/** Variables of the `revokeDocAccess` mutation. */
export interface RevokeDocAccessVariables extends GqlVariables {
  docId: ID;
  userId: ID;
}

/** One entry of the visibility picker. */
export interface DocVisibilityOption {
  value: DocVisibility;
  label: string;
}
