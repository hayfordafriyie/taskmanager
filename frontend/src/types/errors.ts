/**
 * Types for turning thrown/returned failures into a readable message
 * (see `src/lib/errors.ts`).
 */

/** Any of the shapes a failure can arrive in from fetch/GraphQL. */
export interface ErrorPayload {
  message?: unknown;
  error?: unknown;
  graphQLErrors?: unknown;
  errors?: unknown;
  response?: { errors?: unknown } | null;
}

/** Anything that might be thrown or rejected. */
export type ThrownValue = unknown;
