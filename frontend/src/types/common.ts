/**
 * Shared, cross-module types.
 *
 * Every domain has its own file in `src/types/`; this one holds the primitives
 * and entities that more than one module needs, so no component or page has to
 * declare them inline.
 */

/** A server-side identifier (UUID string). */
export type ID = string;

/** An ISO-8601 timestamp as returned by the API. */
export type ISODateString = string;

/** Workspace roles, mirroring the GraphQL `Role` enum. */
export type Role = "ADMIN" | "MEMBER" | "GUEST";

/** A user account. */
export interface User {
  id: ID;
  firstName: string;
  surname: string;
  phone?: string;
  otherNames?: string | null;
  createdAt?: ISODateString;
}

/** A user together with their membership details in a workspace. */
export interface TeamMember extends User {
  role: Role;
  createdAt?: ISODateString;
}

/** Minimal shape of the signed-in user exposed by the auth context. */
export type CurrentUser = Pick<User, "id" | "firstName" | "surname" | "phone"> & {
  otherNames?: string | null;
};

/** A single GraphQL error as returned in the `errors` array. */
export interface GraphQLError {
  message: string;
  path?: ReadonlyArray<string | number>;
}

/** The envelope every GraphQL response is unwrapped from. */
export interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

/** Result shape used by mutations that report success/message. */
export interface MutationResult<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
}

/** Generic async state shared by hooks and views. */
export interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

/** Utility: a value that may be absent. */
export type Maybe<T> = T | null | undefined;
