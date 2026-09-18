/**
 * Global configuration for the AI Trading Bot.
 */

export type Environment = 'testnet' | 'live';

export interface EnvConfig {
  restBase: string;
  wsBase: string;
  label: string;
}

export const ENVIRONMENTS: Record<Environment, EnvConfig> = {
  testnet: {
    restBase: 'https://testnet.binance.vision',
    wsBase: 'wss://testnet.binance.vision',
    label: 'Binance Spot Testnet',
  },
  live: {
    restBase: 'https://api.binance.com',
    wsBase: 'wss://stream.binance.com:9443',
    label: 'Binance Live',
  },
};

/** App version, shown on the Profile screen (keep in sync with app.json). */
export const APP_VERSION = '6.7.0';

/** Default watchlist (top USDT pairs by liquidity). */
export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
];

/** Top-10 ticker list shown on the dashboard. */
export const TOP_TICKERS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
];

/** Timeframes used by the multi-timeframe confluence analysis. */
export const ENGINE_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'] as const;
export type Timeframe = (typeof ENGINE_TIMEFRAMES)[number];

export const KLINE_LIMIT = 250;

/** Binance minimum notional for spot orders (per current exchange filters). */
export const MIN_NOTIONAL_USDT = 5;

/** Klines cache TTL (ms) per timeframe. */
export const KLINE_TTL_MS: Record<string, number> = {
  '1m': 15_000,
  '5m': 30_000,
  '15m': 60_000,
  '1h': 120_000,
  '4h': 300_000,
};

export const BOT_DEFAULTS = {
  tradeAmountUsdt: 100,
  maxOpenTrades: 3,
  stopLossPct: 2,
  takeProfitPct: 4,
  dailyLossLimitPct: 6,
  minSignal: 'BUY' as SignalStrength,
  pollIntervalMs: 30_000,
  paperBalanceUsdt: 10_000,
};

export type SignalStrength = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export const SIGNAL_STRENGTH_ORDER: SignalStrength[] = [
  'STRONG_BUY',
  'BUY',
  'HOLD',
  'SELL',
  'STRONG_SELL',
];

/** Storage keys (AsyncStorage). */
export const STORAGE_KEYS = {
  credentials: '@aitb/credentials.v1',
  demoMode: '@aitb/demoMode.v1',
  security: '@aitb/security.v1',
  botConfig: '@aitb/bot.config.v1',
  positions: '@aitb/bot.positions.v1',
  trades: '@aitb/bot.trades.v1',
  snapshots: '@aitb/equity.snapshots.v1',
};
