/**
 * Per-session AES-GCM helpers. The key is issued by the backend
 * (`POST /api/v1/session`) and never leaves the browser.
 */
let currentKey: string | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

/** Store (or clear) the base64 session key. */
export function setSessionKey(base64Key?: string | null): void {
  currentKey = base64Key ?? null;
  keyPromise = null;
}

/** Import and cache the AES-GCM key for the current session. */
export function sessionKey(): Promise<CryptoKey> {
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
      .catch((err: unknown) => {
        keyPromise = null;
        throw err;
      });
  }
  return keyPromise;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Encrypt a plaintext payload, returning base64(iv || ciphertext). */
export async function encrypt(plaintext: string): Promise<string> {
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

/** Decrypt a base64(iv || ciphertext) payload back to plaintext. */
export async function decrypt(payload: string): Promise<string> {
  const combined = base64ToBytes(payload);
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await sessionKey(),
    ct,
  );
  return new TextDecoder().decode(plain);
}
