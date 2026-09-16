import { aes256Decrypt, aes256Encrypt, hmacSha256Hex, sha256Hex } from '../src/crypto/primitives';

describe('HMAC-SHA256', () => {
  it('matches RFC 4231 test vector 2', () => {
    const sig = hmacSha256Hex('Jefe', 'what do ya want for nothing?');
    expect(sig).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('produces 32-byte hex output', () => {
    expect(hmacSha256Hex('k', 'd')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('SHA-256', () => {
  it('matches the known empty-string digest', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('AES-256-GCM credential vault primitives', () => {
  const key = new Uint8Array(32).fill(7);

  it('round-trips plaintext', () => {
    const secret = JSON.stringify({ apiKey: 'a'.repeat(64), apiSecret: 'b'.repeat(64) });
    const blob = aes256Encrypt(key, secret);
    expect(blob.v).toBe(1);
    expect(aes256Decrypt(key, blob)).toBe(secret);
  });

  it('produces a fresh IV each call', () => {
    const a = aes256Encrypt(key, 'same message');
    const b = aes256Encrypt(key, 'same message');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('rejects a wrong key (auth tag)', () => {
    const blob = aes256Encrypt(key, 'top secret');
    const wrong = new Uint8Array(32).fill(8);
    expect(() => aes256Decrypt(wrong, blob)).toThrow();
  });

  it('detects ciphertext tampering', () => {
    const blob = aes256Encrypt(key, 'top secret');
    const tampered = { ...blob, ct: blob.ct.slice(0, -2) + (blob.ct.endsWith('AA') ? 'BB' : 'AA') };
    expect(() => aes256Decrypt(key, tampered)).toThrow();
  });

  it('requires a 256-bit key', () => {
    expect(() => aes256Encrypt(new Uint8Array(16), 'x')).toThrow('AES-256 requires a 32-byte key');
  });
});
