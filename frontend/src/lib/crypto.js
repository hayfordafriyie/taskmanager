// Symmetric AES-256-GCM encryption shared with the backend. The same base64
// key lives in backend/.env and frontend/.env (see VITE_ENCRYPTION_KEY).
// Payload wire format: base64(nonce || ciphertext), matching the Go side.

const key = (() => {
  let cache;
  return async () => {
    if (!cache) {
      const raw = base64ToBytes(import.meta.env.VITE_ENCRYPTION_KEY);
      cache = await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    return cache;
  };
})();

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
    await key(),
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
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), ct);
  return new TextDecoder().decode(plain);
}