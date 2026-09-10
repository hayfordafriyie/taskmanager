import { encrypt, decrypt, setSessionKey } from './crypto';
import type { GraphQLResponse } from '../types/common';
import type {
  ApiResponse,
  GqlRequestBody,
  GqlVariables,
  RefreshPayload,
  RequestHeaders,
  ServerErrorPayload,
  SessionHandshake,
} from '../types/api';

const API_URL: string = import.meta.env.VITE_API_URL || '';
const API_VERSION: string = import.meta.env.VITE_API_VERSION || 'v1';
const ENCRYPTED_MARKER: string = import.meta.env.VITE_ENCRYPTED_MARKER || '1';
const ACCESS_KEY = 'taskmanager_access_token';
const REFRESH_KEY = 'taskmanager_refresh_token';

export const GRAPHQL_ENDPOINT = `${API_URL}/api/${API_VERSION}/query`;
export const SESSION_ENDPOINT = `${API_URL}/api/${API_VERSION}/session`;
export const EVENTS_ENDPOINT = `${API_URL}/api/${API_VERSION}/events`;

let sessionReady: Promise<void> | null = null;
let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);
let refreshInFlight: Promise<boolean> | null = null;

/** Persist (or clear) the access/refresh token pair. */
export function setTokens(access?: string | null, refresh?: string | null): void {
  accessToken = access || null;
  refreshToken = refresh || null;
  if (accessToken) {
    localStorage.setItem(ACCESS_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_KEY);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function startSession(): Promise<void> {
  const res = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`session handshake failed with status ${res.status}`);
  }
  const { key } = (await res.json()) as SessionHandshake;
  setSessionKey(key);
}

function ensureSession(): Promise<void> {
  if (!sessionReady) {
    sessionReady = startSession().catch((err: unknown) => {
      sessionReady = null;
      throw err;
    });
  }
  return sessionReady;
}

async function readBody(res: Response): Promise<string> {
  const text = await res.text();
  if (res.headers.get('x-encrypted') === ENCRYPTED_MARKER) {
    return decrypt(text);
  }
  return text;
}

async function send(
  query: string,
  variables: GqlVariables,
  headers: RequestHeaders,
): Promise<string> {
  await ensureSession();
  const body = await encrypt(JSON.stringify({ query, variables } satisfies GqlRequestBody));
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers,
    body,
  });
  if (res.status === 401) {
    sessionReady = null;
    setSessionKey(undefined);
    await ensureSession();
    const retried = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: await encrypt(JSON.stringify({ query, variables } satisfies GqlRequestBody)),
    });
    return readBody(retried);
  }
  return readBody(res);
}

function buildHeaders(withAuth?: boolean): RequestHeaders {
  const headers: RequestHeaders = {
    'Content-Type': 'application/json',
    'X-Encrypted': ENCRYPTED_MARKER,
  };
  if (withAuth !== false && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

function parse(plain: string, status: number): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    throw new Error(`server error ${status}: ${plain}`);
  }
  if (status >= 400) {
    // Report what the server actually said ("Passwords do not match",
    // "invalid code", …) instead of a bare "request failed with status 400",
    // which tells the user nothing about what to fix.
    throw new Error(serverReason(parsed) ?? `request failed with status ${status}`);
  }
  return parsed;
}

/** First message the server gave us, from any of the shapes it may use. */
function serverReason(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const payload = parsed as ServerErrorPayload;
  const fromErrors = Array.isArray(payload.errors)
    ? payload.errors.find((e) => e && typeof e.message === 'string' && e.message.trim())
    : null;
  if (fromErrors?.message) return fromErrors.message.trim();
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  return null;
}

function isNotAuthenticated(result: GraphQLResponse<unknown>): boolean {
  if (!result || !Array.isArray(result.errors)) {
    return false;
  }
  return result.errors.some(
    (e) => e && typeof e.message === 'string' && e.message.includes('not authenticated'),
  );
}

async function doRefresh(): Promise<boolean> {
  const token = refreshToken;
  if (!token) {
    return false;
  }
  const query = `mutation { refreshToken(token: "${token}") { success accessToken refreshToken } }`;
  const plain = await send(query, {}, buildHeaders(false));
  const result = parse(plain, 200) as ApiResponse<{ refreshToken?: RefreshPayload }>;
  const data = result?.data?.refreshToken;
  if (data?.success) {
    setTokens(data.accessToken, data.refreshToken);
    return true;
  }
  clearTokens();
  return false;
}

function refreshTokens(): Promise<boolean> {
  if (!refreshToken) {
    return Promise.resolve(false);
  }
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function execute<TData>(
  query: string,
  variables: GqlVariables,
  retried: boolean,
): Promise<ApiResponse<TData>> {
  const plain = await send(query, variables, buildHeaders());
  const result = parse(plain, 200) as ApiResponse<TData>;
  if (!retried && isNotAuthenticated(result) && refreshToken) {
    if (await refreshTokens()) {
      return execute<TData>(query, variables, true);
    }
  }
  return result;
}

/**
 * Run a GraphQL operation. Responses are decrypted transparently and an expired
 * access token is refreshed once before the call is retried.
 */
export async function gql<TData = unknown>(
  query: string,
  variables: GqlVariables = {},
): Promise<ApiResponse<TData>> {
  return execute<TData>(query, variables, false);
}
