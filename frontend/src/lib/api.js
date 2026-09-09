import { encrypt, decrypt, setSessionKey } from './crypto';

const API_URL = import.meta.env.VITE_API_URL || '';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
const ENCRYPTED_MARKER = import.meta.env.VITE_ENCRYPTED_MARKER || '1';
const ACCESS_KEY = 'taskmanager_access_token';
const REFRESH_KEY = 'taskmanager_refresh_token';

export const GRAPHQL_ENDPOINT = `${API_URL}/api/${API_VERSION}/query`;
export const SESSION_ENDPOINT = `${API_URL}/api/${API_VERSION}/session`;

let sessionReady = null;
let accessToken = localStorage.getItem(ACCESS_KEY);
let refreshToken = localStorage.getItem(REFRESH_KEY);
let refreshInFlight = null;

export function setTokens(access, refresh) {
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

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return accessToken;
}

async function startSession() {
  const res = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`session handshake failed with status ${res.status}`);
  }
  const { key } = await res.json();
  setSessionKey(key);
}

function ensureSession() {
  if (!sessionReady) {
    sessionReady = startSession().catch((err) => {
      sessionReady = null;
      throw err;
    });
  }
  return sessionReady;
}

async function readBody(res) {
  const text = await res.text();
  if (res.headers.get('x-encrypted') === ENCRYPTED_MARKER) {
    return decrypt(text);
  }
  return text;
}

async function send(query, variables, headers) {
  await ensureSession();
  const body = await encrypt(JSON.stringify({ query, variables }));
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
      body: await encrypt(JSON.stringify({ query, variables })),
    });
    return readBody(retried);
  }
  return readBody(res);
}

function buildHeaders(withAuth) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Encrypted': ENCRYPTED_MARKER,
  };
  if (withAuth !== false && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

function parse(plain, status) {
  let parsed;
  try {
    parsed = JSON.parse(plain);
  } catch {
    throw new Error(`server error ${status}: ${plain}`);
  }
  if (status >= 400) {
    throw new Error(`request failed with status ${status}`);
  }
  return parsed;
}

function isNotAuthenticated(result) {
  if (!result || !Array.isArray(result.errors)) {
    return false;
  }
  return result.errors.some(
    (e) =>
      e &&
      typeof e.message === 'string' &&
      e.message.includes('not authenticated'),
  );
}

async function doRefresh() {
  const token = refreshToken;
  if (!token) {
    return false;
  }
  const query = `mutation { refreshToken(token: "${token}") { success accessToken refreshToken } }`;
  const plain = await send(query, {}, buildHeaders(false));
  const result = parse(plain, 200);
  const data = result && result.data && result.data.refreshToken;
  if (data && data.success) {
    setTokens(data.accessToken, data.refreshToken);
    return true;
  }
  clearTokens();
  return false;
}

function refreshTokens() {
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

async function execute(query, variables, retried) {
  const plain = await send(query, variables, buildHeaders());
  const result = parse(plain, 200);
  if (!retried && isNotAuthenticated(result) && refreshToken) {
    if (await refreshTokens()) {
      return execute(query, variables, true);
    }
  }
  return result;
}

export async function gql(query, variables = {}) {
  return execute(query, variables, false);
}