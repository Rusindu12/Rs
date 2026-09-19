import * as Crypto from 'expo-crypto';

export const createHmacSignature = async (secret: string, queryString: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(queryString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const buildSignedParams = async (
  params: Record<string, string | number | boolean>,
  secret: string,
  timestamp?: number
): Promise<string> => {
  const ts = timestamp || Date.now();
  const allParams = { ...params, timestamp: ts, recvWindow: 5000 };
  const queryString = Object.entries(allParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  const signature = await createHmacSignature(secret, queryString);
  return `${queryString}&signature=${signature}`;
};

export const validateApiKeyPermissions = async (
  apiKey: string,
  isTestnet: boolean
): Promise<{ canTrade: boolean; canWithdraw: boolean; canDeposit: boolean; error: string }> => {
  try {
    const baseUrl = isTestnet
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com';
    const response = await fetch(`${baseUrl}/api/v3/account?timestamp=${Date.now()}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });

    if (!response.ok) {
      const data = await response.json();
      return { canTrade: false, canWithdraw: false, canDeposit: false, error: data.msg || 'API key validation failed' };
    }

    const data = await response.json();
    return {
      canTrade: data.canTrade,
      canWithdraw: data.canWithdraw,
      canDeposit: data.canDeposit,
      error: '',
    };
  } catch (error: any) {
    return { canTrade: false, canWithdraw: false, canDeposit: false, error: error.message };
  }
};

export const maskApiKey = (key: string): string => {
  if (!key || key.length < 10) return '****';
  return key.slice(0, 6) + '****' + key.slice(-4);
};
