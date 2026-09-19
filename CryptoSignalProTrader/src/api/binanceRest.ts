import axios, { AxiosInstance, AxiosError } from 'axios';
import { getRestBaseUrl, ENDPOINTS } from './endpoints';
import { buildSignedParams } from './binanceAuth';
import { rateLimiter } from './rateLimiter';
import {
  BinanceTicker,
  BinanceKline,
  BinanceOrder,
  BinanceAccountInfo,
  BinanceDepth,
  BinanceExchangeInfo,
  BinanceServerTime,
  BinanceMyTrade,
  BinanceOCOOrder,
  BinanceOrderType,
  BinanceOrderSide,
  BinanceTimeInForce,
  KlineInterval,
} from '../types/binance';

class BinanceRestClient {
  private client: AxiosInstance;
  private apiKey: string = '';
  private apiSecret: string = '';
  private isTestnet: boolean = true;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.client = axios.create({ timeout: 15000 });
  }

  configure(apiKey: string, apiSecret: string, isTestnet: boolean): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isTestnet = isTestnet;
    this.client = axios.create({
      baseURL: getRestBaseUrl(isTestnet),
      timeout: 15000,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  private async request<T>(method: string, endpoint: string, params: Record<string, any> = {}, signed: boolean = false): Promise<T> {
    return rateLimiter.throttle(async () => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          let url = endpoint;
          let data: string | undefined;

          if (signed) {
            const stringParams: Record<string, string> = {};
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                stringParams[key] = String(value);
              }
            });
            const signedQuery = await buildSignedParams(stringParams, this.apiSecret);

            if (method === 'GET' || method === 'DELETE') {
              url = `${endpoint}?${signedQuery}`;
            } else {
              data = signedQuery;
            }
          } else if (method === 'GET') {
            const queryParts = Object.entries(params)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
            if (queryParts.length > 0) {
              url = `${endpoint}?${queryParts.join('&')}`;
            }
          }

          const response = method === 'GET' || method === 'DELETE'
            ? await this.client.get(url)
            : await this.client.post(url, data);

          return response.data as T;
        } catch (error) {
          lastError = error as Error;
          const axiosError = error as AxiosError;

          if (axiosError.response) {
            const status = axiosError.response.status;
            const errorData = axiosError.response.data as any;

            if (status === 429) {
              const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '60');
              await new Promise(r => setTimeout(r, retryAfter * 1000));
              continue;
            }

            if (status === 418) {
              throw new Error(`IP banned by Binance. Retry after: ${axiosError.response.headers['retry-after']}s`);
            }

            if (status >= 400 && status < 500) {
              throw new Error(`Binance API Error ${status}: ${errorData?.msg || 'Unknown error'} (code: ${errorData?.code})`);
            }
          }

          if (attempt < this.retryAttempts) {
            await new Promise(r => setTimeout(r, this.retryDelay * attempt));
          }
        }
      }

      throw lastError || new Error('Request failed after retries');
    });
  }

  // ============ Market Data ============

  async getServerTime(): Promise<BinanceServerTime> {
    return this.request<BinanceServerTime>('GET', ENDPOINTS.SERVER_TIME);
  }

  async getExchangeInfo(): Promise<BinanceExchangeInfo> {
    return this.request<BinanceExchangeInfo>('GET', ENDPOINTS.EXCHANGE_INFO);
  }

  async getTicker24hr(symbol?: string): Promise<BinanceTicker | BinanceTicker[]> {
    const params = symbol ? { symbol } : {};
    return this.request<any>('GET', ENDPOINTS.TICKER_24HR, params);
  }

  async getTickerPrice(symbol?: string): Promise<{ symbol: string; price: string } | { symbol: string; price: string }[]> {
    const params = symbol ? { symbol } : {};
    return this.request<any>('GET', ENDPOINTS.TICKER_PRICE, params);
  }

  async getKlines(symbol: string, interval: KlineInterval, limit: number = 500, startTime?: number, endTime?: number): Promise<BinanceKline[]> {
    const params: Record<string, any> = { symbol, interval, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    const raw = await this.request<any[][]>('GET', ENDPOINTS.KLINES, params);
    return raw.map(k => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteAssetVolume: k[7],
      numberOfTrades: k[8],
      takerBuyBaseAssetVolume: k[9],
      takerBuyQuoteAssetVolume: k[10],
      ignore: k[11],
    }));
  }

  async getDepth(symbol: string, limit: number = 100): Promise<BinanceDepth> {
    return this.request<BinanceDepth>('GET', ENDPOINTS.DEPTH, { symbol, limit });
  }

  async getAggTrades(symbol: string, limit: number = 500): Promise<any[]> {
    return this.request<any>('GET', ENDPOINTS.AGG_TRADES, { symbol, limit });
  }

  async getAvgPrice(symbol: string): Promise<{ mins: number; price: string }> {
    return this.request<any>('GET', ENDPOINTS.AVG_PRICE, { symbol });
  }

  // ============ Account ============

  async getAccount(): Promise<BinanceAccountInfo> {
    return this.request<BinanceAccountInfo>('GET', ENDPOINTS.ACCOUNT, {}, true);
  }

  async getMyTrades(symbol: string, limit: number = 500, fromId?: number): Promise<BinanceMyTrade[]> {
    const params: Record<string, any> = { symbol, limit };
    if (fromId) params.fromId = fromId;
    return this.request<BinanceMyTrade[]>('GET', ENDPOINTS.MY_TRADES, params, true);
  }

  async getAllOrders(symbol: string, limit: number = 500): Promise<BinanceOrder[]> {
    return this.request<BinanceOrder[]>('GET', ENDPOINTS.ALL_ORDERS, { symbol, limit }, true);
  }

  // ============ Orders ============

  async placeOrder(params: {
    symbol: string;
    side: BinanceOrderSide;
    type: BinanceOrderType;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: BinanceTimeInForce;
    newClientOrderId?: string;
    icebergQty?: number;
  }): Promise<BinanceOrder> {
    const orderParams: Record<string, any> = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
    };
    if (params.quantity !== undefined) orderParams.quantity = params.quantity;
    if (params.quoteOrderQty !== undefined) orderParams.quoteOrderQty = params.quoteOrderQty;
    if (params.price !== undefined) orderParams.price = params.price;
    if (params.stopPrice !== undefined) orderParams.stopPrice = params.stopPrice;
    if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
    if (params.newClientOrderId) orderParams.newClientOrderId = params.newClientOrderId;
    if (params.icebergQty !== undefined) orderParams.icebergQty = params.icebergQty;

    return this.request<BinanceOrder>('POST', ENDPOINTS.ORDER, orderParams, true);
  }

  async placeOCOOrder(params: {
    symbol: string;
    side: BinanceOrderSide;
    quantity: number;
    price: number;
    stopPrice: number;
    stopLimitPrice: number;
    stopLimitTimeInForce: BinanceTimeInForce;
  }): Promise<BinanceOCOOrder> {
    return this.request<BinanceOCOOrder>('POST', ENDPOINTS.OCO_ORDER, params, true);
  }

  async cancelOrder(symbol: string, orderId: number): Promise<BinanceOrder> {
    return this.request<BinanceOrder>('DELETE', ENDPOINTS.ORDER, { symbol, orderId }, true);
  }

  async cancelAllOpenOrders(symbol: string): Promise<any> {
    return this.request<any>('DELETE', ENDPOINTS.OPEN_ORDERS, { symbol }, true);
  }

  async getOrderStatus(symbol: string, orderId: number): Promise<BinanceOrder> {
    return this.request<BinanceOrder>('GET', ENDPOINTS.ORDER, { symbol, orderId }, true);
  }

  async getOpenOrders(symbol?: string): Promise<BinanceOrder[]> {
    const params = symbol ? { symbol } : {};
    return this.request<BinanceOrder[]>('GET', ENDPOINTS.OPEN_ORDERS, params, true);
  }

  // ============ User Data Stream ============

  async createListenKey(): Promise<string> {
    const result = await this.request<{ listenKey: string }>('POST', ENDPOINTS.LISTEN_KEY);
    return result.listenKey;
  }

  async keepAliveListenKey(listenKey: string): Promise<void> {
    await this.request<any>('PUT', ENDPOINTS.LISTEN_KEY, { listenKey });
  }

  async closeListenKey(listenKey: string): Promise<void> {
    await this.request<any>('DELETE', ENDPOINTS.LISTEN_KEY, { listenKey });
  }

  // ============ Helper Methods ============

  async testConnection(): Promise<{ success: boolean; latency: number; serverTime: number; error?: string }> {
    const start = Date.now();
    try {
      const time = await this.getServerTime();
      const latency = Date.now() - start;
      return { success: true, latency, serverTime: time.serverTime };
    } catch (error: any) {
      return { success: false, latency: 0, serverTime: 0, error: error.message };
    }
  }

  async getBalance(asset: string): Promise<{ free: number; locked: number; total: number }> {
    const account = await this.getAccount();
    const balance = account.balances.find(b => b.asset === asset);
    if (!balance) return { free: 0, locked: 0, total: 0 };
    const free = parseFloat(balance.free);
    const locked = parseFloat(balance.locked);
    return { free, locked, total: free + locked };
  }

  async getUSDTBalance(): Promise<number> {
    const balance = await this.getBalance('USDT');
    return balance.free;
  }
}

export const binanceRest = new BinanceRestClient();
export default BinanceRestClient;
