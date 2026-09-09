import { encrypt, decrypt, setSessionKey } from './crypto';

export const API_VERSION = 'v1';
export const GRAPHQL_ENDPOINT = `/api/${API_VERSION}/query`;
export const SESSION_ENDPOINT = `/api/${API_VERSION}/session`;

let sessionReady = null;




async function startSession() {
  const res = await fetch(SESSION_ENDPOINT, { method: 'POST' });
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
  if (res.headers.get('x-encrypted') === '1') {
    return decrypt(text);
  }
  return text;
}






export async function gql(query, variables = {}) {
  await ensureSession();
  const body = await encrypt(JSON.stringify({ query, variables }));
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Encrypted': '1',
    },
    body,
  });
  if (res.status === 401) {
    
    sessionReady = null;
    setSessionKey(undefined);
    await ensureSession();
    const retried = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Encrypted': '1',
      },
      body: await encrypt(JSON.stringify({ query, variables })),
    });
    return finish(await readBody(retried), retried.status);
  }
  return finish(await readBody(res), res.status);
}

function finish(plain, status) {
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