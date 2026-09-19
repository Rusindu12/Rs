import { BINANCE_REST_BASE, BINANCE_TESTNET_REST, BINANCE_WS_BASE, BINANCE_TESTNET_WS } from '../utils/constants';

export const getRestBaseUrl = (isTestnet: boolean): string => {
  return isTestnet ? BINANCE_TESTNET_REST : BINANCE_REST_BASE;
};

export const getWsBaseUrl = (isTestnet: boolean): string => {
  return isTestnet ? BINANCE_TESTNET_WS : BINANCE_WS_BASE;
};

export const ENDPOINTS = {
  // Market Data
  TICKER_24HR: '/api/v3/ticker/24hr',
  TICKER_PRICE: '/api/v3/ticker/price',
  KLINES: '/api/v3/klines',
  DEPTH: '/api/v3/depth',
  AGG_TRADES: '/api/v3/aggTrades',
  EXCHANGE_INFO: '/api/v3/exchangeInfo',
  SERVER_TIME: '/api/v3/time',
  AVG_PRICE: '/api/v3/avgPrice',

  // Account
  ACCOUNT: '/api/v3/account',
  MY_TRADES: '/api/v3/myTrades',
  OPEN_ORDERS: '/api/v3/openOrders',
  ALL_ORDERS: '/api/v3/allOrders',

  // Trading
  ORDER: '/api/v3/order',
  ORDER_TEST: '/api/v3/order/test',
  OCO_ORDER: '/api/v3/order/oco',
  ORDER_OCO: '/api/v3/orderList/oco',

  // User Data Stream
  LISTEN_KEY: '/api/v3/userDataStream',
};

export const WS_STREAMS = {
  ticker: (symbol: string) => `${symbol.toLowerCase()}@ticker`,
  miniTicker: (symbol: string) => `${symbol.toLowerCase()}@miniTicker`,
  kline: (symbol: string, interval: string) => `${symbol.toLowerCase()}@kline_${interval}`,
  trade: (symbol: string) => `${symbol.toLowerCase()}@trade`,
  aggTrade: (symbol: string) => `${symbol.toLowerCase()}@aggTrade`,
  depth: (symbol: string, levels: number = 10, speed: number = 100) =>
    `${symbol.toLowerCase()}@depth${levels}@${speed}ms`,
  allMiniTickers: () => '!miniTicker@arr',
  allTickers: () => '!ticker@arr',
  userData: (listenKey: string) => listenKey,
};

export const buildStreamUrl = (isTestnet: boolean, streams: string[]): string => {
  const base = isTestnet
    ? 'wss://testnet.binance.vision/stream?streams='
    : 'wss://stream.binance.com:9443/stream?streams=';
  return base + streams.join('/');
};
