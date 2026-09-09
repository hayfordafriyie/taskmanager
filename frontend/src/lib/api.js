import { encrypt, decrypt } from './crypto';

export const API_VERSION = 'v1';
export const GRAPHQL_ENDPOINT = `/api/${API_VERSION}/query`;

async function readBody(res) {
  const text = await res.text();
  if (res.headers.get('x-encrypted') === '1') {
    return decrypt(text);
  }
  return text;
}

/**
 * Sends an encrypted GraphQL request to /api/v1/query and returns the
 * decrypted JSON envelope ({ data, errors }).
 */
export async function gql(query, variables = {}) {
  const body = await encrypt(JSON.stringify({ query, variables }));
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Encrypted': '1',
    },
    body,
  });
  const plain = await readBody(res);
  let parsed;
  try {
    parsed = JSON.parse(plain);
  } catch {
    throw new Error(`server error ${res.status}: ${plain}`);
  }
  if (!res.ok) {
    throw new Error(`request failed with status ${res.status}`);
  }
  return parsed;
}