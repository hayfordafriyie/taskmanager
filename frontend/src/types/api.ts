/**
 * Types for the transport layer (`src/lib/api.ts`) — request bodies, the
 * session handshake and the shapes the server uses when it reports a failure.
 */
import type { GraphQLResponse } from "./common";

/** Variables passed to a GraphQL operation. */
export type GqlVariables = Record<string, unknown>;

/** The JSON envelope that is encrypted and POSTed to the GraphQL endpoint. */
export interface GqlRequestBody {
  query: string;
  variables: GqlVariables;
}

/** Response of `POST /api/v1/session`. */
export interface SessionHandshake {
  key: string;
}

/** Any of the shapes the API uses to explain a failure. */
export interface ServerErrorPayload {
  errors?: ReadonlyArray<{ message?: string }>;
  message?: string;
  error?: string;
}

/** Payload of the `refreshToken` mutation. */
export interface RefreshPayload {
  success?: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
}

/** A parsed GraphQL response from the API. */
export type ApiResponse<TData> = GraphQLResponse<TData>;

/** Request headers built for a call. */
export type RequestHeaders = Record<string, string>;
