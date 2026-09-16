import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  aes256Decrypt,
  aes256Encrypt,
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  type AesCiphertext,
} from '../crypto/primitives';
import { STORAGE_KEYS, type Environment } from '../config';

/**
 * Encrypted credential vault.
 *
 * • A random 256-bit master key is generated on first use and stored in
 *   Android Keystore–backed storage (expo-secure-store, hardware encrypted).
 * • API credentials are serialized to JSON and encrypted with AES-256-GCM
 *   (authenticated encryption) before being written to local storage.
 * • Plaintext credentials only ever exist in memory while the app runs.
 */

const MASTER_KEY_NAME = 'aitb.masterKey.v1';

export interface StoredCredentials {
  apiKey: string;
  apiSecret: string;
  environment: Environment;
  savedAt: number;
}

async function getMasterKey(): Promise<Uint8Array> {
  let b64 = await SecureStore.getItemAsync(MASTER_KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!b64) {
    const key = randomBytes(32);
    b64 = bytesToBase64(key);
    await SecureStore.setItemAsync(MASTER_KEY_NAME, b64, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  }
  const key = base64ToBytes(b64);
  if (key.length !== 32) throw new Error('corrupt master key');
  return key;
}

export async function saveCredentials(creds: Omit<StoredCredentials, 'savedAt'>): Promise<void> {
  const key = await getMasterKey();
  const blob: AesCiphertext = aes256Encrypt(
    key,
    JSON.stringify({ ...creds, savedAt: Date.now() })
  );
  await AsyncStorage.setItem(STORAGE_KEYS.credentials, JSON.stringify(blob));
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.credentials);
  if (!raw) return null;
  try {
    const key = await getMasterKey();
    const blob = JSON.parse(raw) as AesCiphertext;
    return JSON.parse(aes256Decrypt(key, blob)) as StoredCredentials;
  } catch {
    // Wrong key / corrupted / tampered ciphertext.
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.credentials);
}

/* --------------------------- security settings -------------------------- */

export interface SecuritySettings {
  biometricEnabled: boolean;
}

export async function loadSecuritySettings(): Promise<SecuritySettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.security);
  return raw ? (JSON.parse(raw) as SecuritySettings) : { biometricEnabled: false };
}

export async function saveSecuritySettings(s: SecuritySettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.security, JSON.stringify(s));
}
