import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes } from '@noble/hashes/utils';

/**
 * Pure-TypeScript cryptographic primitives (Hermes-compatible, no native
 * modules): HMAC-SHA256 for Binance request signing and AES-256-GCM for
 * credential encryption at rest.
 */

export function sha256Hex(data: string | Uint8Array): string {
  return toHex(sha256(typeof data === 'string' ? utf8ToBytes(data) : data));
}

export function hmacSha256Bytes(key: string, data: string): Uint8Array {
  return hmac(sha256, typeof key === 'string' ? utf8ToBytes(key) : key, utf8ToBytes(data));
}

export function hmacSha256Hex(key: string, data: string): string {
  return toHex(hmacSha256Bytes(key, data));
}

export function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  // react-native-get-random-values polyfills global crypto.getRandomValues on RN.
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues unavailable — add react-native-get-random-values');
  }
  globalThis.crypto.getRandomValues(out);
  return out;
}

export interface AesCiphertext {
  v: 1;
  iv: string; // base64
  ct: string; // base64 (AES-256-GCM, includes 16-byte auth tag)
}

/** AES-256-GCM encrypt a UTF-8 string. */
export function aes256Encrypt(keyBytes: Uint8Array, plaintext: string): AesCiphertext {
  if (keyBytes.length !== 32) throw new Error('AES-256 requires a 32-byte key');
  const iv = randomBytes(12);
  const ct = gcm(keyBytes, iv).encrypt(utf8ToBytes(plaintext));
  return { v: 1, iv: toBase64(iv), ct: toBase64(ct) };
}

/** AES-256-GCM decrypt. Throws if the key is wrong or the tag invalid. */
export function aes256Decrypt(keyBytes: Uint8Array, blob: AesCiphertext): string {
  if (keyBytes.length !== 32) throw new Error('AES-256 requires a 32-byte key');
  const pt = gcm(keyBytes, fromBase64(blob.iv)).decrypt(fromBase64(blob.ct));
  return new TextDecoder().decode(pt);
}

/* ----------------------------- encoding --------------------------------- */

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa exists on Hermes (React Native) and in Node ≥ 16 / browsers.
  return globalThis.btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return toBase64(bytes);
}

export function base64ToBytes(b64: string): Uint8Array {
  return fromBase64(b64);
}
