import { hmacSha256Hex } from '../../crypto/primitives';
import { ENVIRONMENTS, type Environment } from '../../config';

/**
 * Binance Spot REST client (live + testnet).
 *
 * Signed endpoints use HMAC-SHA256 over the query string, exactly as the
 * Binance API requires, with the key in the `X-MBX-APIKEY` header.
 */
/** Public market-data hosts tried in order (the .vision mirror often works
 *  when api.binance.com is blocked or rate-limited on a home network). */
const LIVE_PUBLIC_BASES = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
];
/** Signed (account/order) endpoints must hit real Binance hosts only. */
const LIVE_SIGNED_BASES = [
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
];

export class BinanceRest {
  /** Host currently used for public data (for diagnostics). */
  activePublicBase = '';
  /**
   * Keys may be empty for PUBLIC-data-only use (demo mode: tickers, klines,
   * ping). Signed/account endpoints throw until real keys are configured.
   */
  constructor(
    private apiKey: string,
    private apiSecret: string,
    private env: Environment = 'testnet'
  ) {}

  setEnv(env: Environment) {
    this.env = env;
  }

  private base(signed = false): string {
    if (this.env !== 'live') return ENVIRONMENTS[this.env].restBase;
    return signed ? LIVE_SIGNED_BASES[0] : this.activePublicBase || LIVE_PUBLIC_BASES[0];
  }

  /** Run `fn` against each live public host until one succeeds. */
  private async withFailover<T>(path: string, init?: RequestInit): Promise<T> {
    const bases = this.env !== 'live' ? [ENVIRONMENTS[this.env].restBase] : this.activePublicBase
      ? [this.activePublicBase, ...LIVE_PUBLIC_BASES.filter((b) => b !== this.activePublicBase)]
      : LIVE_PUBLIC_BASES;
    let lastErr: unknown;
    for (const b of bases) {
      try {
        const res = await fetch(`${b}${path}`, init);
        if (!res.ok) throw new BinanceApiError(res.status, await safeMessage(res));
        this.activePublicBase = b;
        return (await res.json()) as T;
      } catch (e) {
        lastErr = e;
      }
    }
    this.activePublicBase = '';
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base()}/api/v3/ping`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Server-time drift in ms (serverTime - localNow). */
  async timeDrift(): Promise<number> {
    const j = (await this.publicJson('/api/v3/time')) as { serverTime: number };
    return j.serverTime - Date.now();
  }

  private async publicJson(path: string, init?: RequestInit): Promise<unknown> {
    return this.withFailover(path, init);
  }

  /** GET a signed endpoint. `params` values are stringified into the query string. */
  private async signed<T>(path: string, params: Record<string, string | number | boolean> = {}, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Connect your Binance API keys to use this feature');
    }
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    q.set('timestamp', String(Date.now() + this.recvWindowAdjustMs));
    q.set('recvWindow', '10000');
    const query = q.toString();
    const signature = hmacSha256Hex(this.apiSecret, query);
    const url = `${this.base(true)}${path}?${query}&signature=${signature}`;
    const res = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': this.apiKey },
    });
    if (!res.ok) throw new BinanceApiError(res.status, await safeMessage(res));
    return (await res.json()) as T;
  }

  private recvWindowAdjustMs = 0;

  async syncTime(): Promise<void> {
    try {
      this.recvWindowAdjustMs = Math.max(-5000, Math.min(5000, await this.timeDrift()));
    } catch {
      this.recvWindowAdjustMs = 0;
    }
  }

  /** Multi-symbol 24h tickers. */
  async tickers24h(symbols: string[]): Promise<Ticker24h[]> {
    const q = encodeURIComponent(JSON.stringify(symbols));
    return this.publicJson(`/api/v3/ticker/24hr?symbols=${q}`) as Promise<Ticker24h[]>;
  }

  async klines(symbol: string, interval: string, limit = 250): Promise<Kline[]> {
    const rows = (await this.publicJson(
      `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )) as unknown[][];
    return rows.map((r) => ({
      openTime: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
      closeTime: Number(r[6]),
      quoteVolume: Number(r[7]),
      trades: Number(r[8]),
    }));
  }

  async exchangeInfo(symbols: string[]): Promise<ExchangeInfo> {
    const q = encodeURIComponent(JSON.stringify(symbols));
    return this.publicJson(`/api/v3/exchangeInfo?symbols=${q}`) as Promise<ExchangeInfo>;
  }

  async account(): Promise<AccountInfo> {
    return this.signed<AccountInfo>('/api/v3/account');
  }

  /** Market buy spending `quoteQty` USDT. */
  async marketBuy(symbol: string, quoteQty: number): Promise<OrderFill> {
    const resp = await this.signed<OrderResponse>(
      '/api/v3/order',
      {
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: quoteQty,
        newOrderRespType: 'FULL',
      },
      'POST'
    );
    return fillsToOrderFill(resp, quoteQty);
  }

  /** Market sell `quantity` of the base asset. */
  async marketSell(symbol: string, quantity: number): Promise<OrderFill> {
    const resp = await this.signed<OrderResponse>(
      '/api/v3/order',
      {
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: trimQty(quantity),
        newOrderRespType: 'FULL',
      },
      'POST'
    );
    return fillsToOrderFill(resp, 0);
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    await this.signed('/api/v3/openOrders', { symbol }, 'DELETE');
  }

  async openOrders(): Promise<OpenOrder[]> {
    return this.signed<OpenOrder[]>('/api/v3/openOrders');
  }

  /**
   * Server-side OCO (one-cancels-other) protection: a SELL take-profit limit
   * leg + a stop-loss stop-limit leg. The order lives on Binance's servers —
   * it executes even when this app is offline. Returns the orderListId.
   */
  async placeOco(symbol: string, quantity: number, takeProfitPrice: number, stopPrice: number): Promise<string | null> {
    const params = ocoParams(symbol, quantity, takeProfitPrice, stopPrice);
    const resp = await this.signed<{ orderListId?: number }>('/api/v3/order/oco', params, 'POST');
    return resp?.orderListId != null ? String(resp.orderListId) : null;
  }

  async cancelOco(symbol: string, orderListId: string): Promise<void> {
    await this.signed('/api/v3/orderList', { symbol, orderListId }, 'DELETE');
  }

  /** Current price for one symbol (24h ticker last price). */
  async lastPrice(symbol: string): Promise<number> {
    const rows = await this.tickers24h([symbol]);
    return Number(rows[0]?.lastPrice ?? 0);
  }
}

/* ------------------------------- helpers -------------------------------- */

function trimQty(qty: number): string {
  // Binance rejects quantities with more than 8 decimals.
  return qty.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

/** Price rounding that fits Binance tick sizes across typical pairs. */
export function binancePrice(p: number): string {
  const decimals = p >= 1000 ? 2 : p >= 100 ? 3 : p >= 1 ? 4 : p >= 0.01 ? 6 : 8;
  return p.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

/** Pure builder for the OCO request — unit-tested. */
export function ocoParams(
  symbol: string,
  quantity: number,
  takeProfitPrice: number,
  stopPrice: number
): Record<string, string> {
  return {
    symbol,
    side: 'SELL',
    quantity: trimQty(quantity),
    price: binancePrice(takeProfitPrice), // take-profit limit leg
    stopPrice: binancePrice(stopPrice), // stop-loss trigger
    stopLimitPrice: binancePrice(stopPrice * 0.995), // 0.5% below trigger so the limit fills in fast moves
    stopLimitTimeInForce: 'GTC',
  };
}

async function safeMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { msg?: string };
    return j.msg ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export class BinanceApiError extends Error {
  constructor(public status: number, message: string) {
    super(`Binance ${status}: ${message}`);
  }
}

function fillsToOrderFill(resp: OrderResponse, fallbackQuote: number): OrderFill {
  const fills = resp.fills ?? [];
  let executedQty = Number(resp.executedQty ?? 0);
  let cumQuote = Number(resp.cummulativeQuoteQty ?? 0);
  if (!executedQty && fills.length) executedQty = fills.reduce((s, f) => s + Number(f.qty), 0);
  if (!cumQuote && fills.length) cumQuote = fills.reduce((s, f) => s + Number(f.price) * Number(f.qty), 0);
  if (!cumQuote && resp.side === 'BUY') cumQuote = fallbackQuote;
  const fee = fills.reduce((s, f) => s + Number(f.commission ?? 0), 0);
  // Commission is usually denominated in the base asset; approximate USD fee.
  const avgPrice = executedQty > 0 ? cumQuote / executedQty : 0;
  return {
    qty: executedQty,
    price: avgPrice,
    feeUsdt: fee * (avgPrice || 1),
  };
}

/* -------------------------------- types --------------------------------- */

export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

export interface ExchangeInfo {
  symbols: {
    symbol: string;
    status: string;
    permissions?: string[];
  }[];
}

export interface AccountInfo {
  canTrade: boolean;
  accountType: string;
  permissions?: string[];
  balances: { asset: string; free: string; locked: string }[];
}

export interface OpenOrder {
  symbol: string;
  orderId: number;
  side: string;
  type: string;
  price: string;
  origQty: string;
  orderListId?: number;
}

interface OrderResponse {
  symbol: string;
  side?: string;
  orderId: number;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills?: { price: string; qty: string; commission: string }[];
}

export interface OrderFill {
  qty: number;
  price: number;
  feeUsdt: number;
}
