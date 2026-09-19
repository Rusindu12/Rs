import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_PREFIX = 'csaip_';

export const encryptAndStore = async (key: string, value: string): Promise<void> => {
  const storeKey = KEY_PREFIX + key;
  await SecureStore.setItemAsync(storeKey, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const retrieveAndDecrypt = async (key: string): Promise<string | null> => {
  const storeKey = KEY_PREFIX + key;
  return await SecureStore.getItemAsync(storeKey);
};

export const removeFromSecureStore = async (key: string): Promise<void> => {
  const storeKey = KEY_PREFIX + key;
  await SecureStore.deleteItemAsync(storeKey);
};

export const storeApiKey = async (apiKey: string): Promise<void> => {
  await encryptAndStore('api_key', apiKey);
};

export const storeApiSecret = async (apiSecret: string): Promise<void> => {
  await encryptAndStore('api_secret', apiSecret);
};

export const getApiKey = async (): Promise<string | null> => {
  return retrieveAndDecrypt('api_key');
};

export const getApiSecret = async (): Promise<string | null> => {
  return retrieveAndDecrypt('api_secret');
};

export const clearApiCredentials = async (): Promise<void> => {
  await removeFromSecureStore('api_key');
  await removeFromSecureStore('api_secret');
};

export const storePin = async (pin: string): Promise<void> => {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  await encryptAndStore('pin_hash', hash);
};

export const verifyPin = async (pin: string): Promise<boolean> => {
  const storedHash = await retrieveAndDecrypt('pin_hash');
  if (!storedHash) return false;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  return hash === storedHash;
};

export const hasStoredPin = async (): Promise<boolean> => {
  const hash = await retrieveAndDecrypt('pin_hash');
  return hash !== null;
};

export const removePin = async (): Promise<void> => {
  await removeFromSecureStore('pin_hash');
};

export const generateSecureId = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
};
