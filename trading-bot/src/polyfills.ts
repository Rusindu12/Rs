/**
 * Hermes polyfills. Must be the FIRST import in the app entry so that any
 * later module sees the patched globals.
 */
import * as ExpoCrypto from 'expo-crypto';

type RV = <T extends ArrayBufferView>(array: T) => T;

const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.crypto !== 'object' || g.crypto === null) {
  g.crypto = {};
}
const cryptoObj = g.crypto as { getRandomValues?: RV };
if (typeof cryptoObj.getRandomValues !== 'function') {
  cryptoObj.getRandomValues = (<T extends ArrayBufferView>(array: T): T => {
    ExpoCrypto.getRandomValues(array as unknown as Uint8Array);
    return array;
  }) as RV;
}

export {};
