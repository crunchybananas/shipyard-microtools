/**
 * Crypto utilities for Harbor Chat.
 *
 * This is a mock implementation that stubs the Web Crypto API patterns
 * we'll use in production. The real implementation will use:
 * - X25519 for key agreement (ECDH)
 * - XChaCha20-Poly1305 for symmetric encryption
 * - Double Ratchet for forward secrecy
 *
 * For the POC, we use AES-GCM via Web Crypto API to demonstrate
 * the encryption/decryption flow without external dependencies.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKeyRaw: string,
): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(publicKeyRaw), (c) => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptMessage(
  encrypted: string,
  key: CryptoKey,
): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return decoder.decode(plaintext);
}

/**
 * Generate a fingerprint for key verification (safety numbers).
 * In production this would use a proper fingerprint comparison protocol.
 */
export async function generateFingerprint(publicKeyRaw: string): Promise<string> {
  const data = encoder.encode(publicKeyRaw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Format as groups of 5 for readability
  return hex.match(/.{1,5}/g)!.slice(0, 8).join(" ");
}
