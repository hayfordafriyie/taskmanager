// AES-256-GCM encryption using a per-session key issued by the backend via
// POST /api/v1/session. The static key is never baked into the bundle; each
// browser acquires its own key at runtime.
// Payload wire format: base64(nonce || ciphertext), matching the Go side.

let currentKey = null;
let keyPromise = null;

export function setSessionKey(base64Key) {
  currentKey = base64Key;
  keyPromise = null;
}

// Returns a promise of a cached CryptoKey. If keyPromise is set (a handshake
// is in flight), all callers share that same handshake.
export function sessionKey() {
  if (!currentKey) {
    throw new Error(
      'no session key set; acquire one via POST /api/v1/session first',
    );
  }
  if (!keyPromise) {
    keyPromise = crypto.subtle
      .importKey('raw', base64ToBytes(currentKey), { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ])
      .catch((err) => {
        keyPromise = null;
        throw err;
      });
  }
  return keyPromise;
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function encrypt(plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await sessionKey(),
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return bytesToBase64(combined);
}

export async function decrypt(payload) {
  const combined = base64ToBytes(payload);
  const iv = combined.subarray(0, 12);
  const ct = combined.subarray(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await sessionKey(),
    ct,
  );
  return new TextDecoder().decode(plain);
}