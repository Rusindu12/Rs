import { BinanceRest } from '../src/services/binance/rest';
import { hmacSha256Hex } from '../src/crypto/primitives';

/**
 * Verifies the signed-request contract: query string, timestamp, recvWindow,
 * HMAC-SHA256 signature and the X-MBX-APIKEY header.
 */

const KEY = 'a'.repeat(64);
const SECRET = 'b'.repeat(64);

function mockFetch(handler: (url: string, init: RequestInit | undefined) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  (globalThis as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return calls;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('BinanceRest', () => {
  it('rejects empty credentials', () => {
    expect(() => new BinanceRest('', '')).toThrow();
  });

  it('signs private requests with HMAC-SHA256 and the API-key header', async () => {
    const calls = mockFetch(() => jsonResponse({ canTrade: true, balances: [] }));
    const rest = new BinanceRest(KEY, SECRET, 'testnet');
    await rest.account();

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://testnet.binance.vision/api/v3/account');
    expect(calls[0].init?.headers).toMatchObject({ 'X-MBX-APIKEY': KEY });

    const qs = url.searchParams;
    const signature = qs.get('signature');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    // Recompute the expected signature over the exact query sent.
    const params = new URLSearchParams(qs);
    params.delete('signature');
    const expected = hmacSha256Hex(SECRET, params.toString());
    expect(signature).toBe(expected);
    expect(qs.get('recvWindow')).toBe('10000');
    expect(Number(qs.get('timestamp'))).toBeGreaterThan(0);
  });

  it('sends market orders with the right params (quoteOrderQty for buys)', async () => {
    const calls = mockFetch(() =>
      jsonResponse({
        symbol: 'BTCUSDT',
        orderId: 1,
        executedQty: '0.5',
        cummulativeQuoteQty: '25000',
        fills: [{ price: '50000', qty: '0.5', commission: '0.0005' }],
      })
    );
    const rest = new BinanceRest(KEY, SECRET, 'live');
    const fill = await rest.marketBuy('BTCUSDT', 25_000);

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://api.binance.com/api/v3/order');
    expect(calls[0].init?.method).toBe('POST');
    expect(url.searchParams.get('symbol')).toBe('BTCUSDT');
    expect(url.searchParams.get('side')).toBe('BUY');
    expect(url.searchParams.get('type')).toBe('MARKET');
    expect(url.searchParams.get('quoteOrderQty')).toBe('25000');
    expect(fill.qty).toBeCloseTo(0.5);
    expect(fill.price).toBeCloseTo(50_000);
    // commission 0.0005 BTC ≈ 25 USDT at the fill price
    expect(fill.feeUsdt).toBeCloseTo(25, 4);
  });

  it('market sells use quantity', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ symbol: 'BTCUSDT', orderId: 2, executedQty: '1', cummulativeQuoteQty: '50000', fills: [] })
    );
    const rest = new BinanceRest(KEY, SECRET, 'live');
    await rest.marketSell('BTCUSDT', 1.2345678901234);
    const q = new URL(calls[0].url).searchParams;
    expect(q.get('side')).toBe('SELL');
    expect(q.get('quantity')).toBe('1.23456789');
  });

  it('surfaces Binance error messages', async () => {
    mockFetch(() => jsonResponse({ code: -2015, msg: 'Invalid API-key, IP, or permissions' }, 401));
    const rest = new BinanceRest(KEY, SECRET, 'testnet');
    await expect(rest.account()).rejects.toThrow('Invalid API-key');
  });

  it('klines map raw arrays into Candle objects', async () => {
    mockFetch(() =>
      jsonResponse([
        [1700000000000, '100', '110', '90', '105', '12', 1700000059999, '1234.5', 77, '0', '0', '0'],
      ])
    );
    const rest = new BinanceRest(KEY, SECRET, 'testnet');
    const [k] = await rest.klines('BTCUSDT', '1m', 1);
    expect(k.open).toBe(100);
    expect(k.close).toBe(105);
    expect(k.volume).toBe(12);
    expect(k.quoteVolume).toBe(1234.5);
    expect(k.trades).toBe(77);
  });
});
