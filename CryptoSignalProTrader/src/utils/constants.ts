export const BINANCE_REST_BASE = 'https://api.binance.com';
export const BINANCE_TESTNET_REST = 'https://testnet.binance.vision';
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
export const BINANCE_TESTNET_WS = 'wss://testnet.binance.vision/ws';
export const BINANCE_COMBINED_WS = 'wss://stream.binance.com:9443/stream?streams=';
export const BINANCE_TESTNET_COMBINED_WS = 'wss://testnet.binance.vision/stream?streams=';

export const DEFAULT_TRADING_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'MATICUSDT',
  'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT',
];

export const KLINE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const;

export const FEAR_GREED_API = 'https://api.alternative.me/fng/';

export const RATE_LIMIT_MAX_REQUESTS = 1200;
export const RATE_LIMIT_WINDOW_MS = 60000;

export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 32000, 60000];

export const SIGNAL_THRESHOLDS = {
  STRONG_BUY: 65,
  BUY: 35,
  WEAK_BUY: 15,
  HOLD_UPPER: 15,
  HOLD_LOWER: -15,
  WEAK_SELL: -15,
  SELL: -35,
  STRONG_SELL: -65,
};

export const RISK_DEFAULTS = {
  MAX_TRADE_PCT: 3.0,
  DAILY_LOSS_LIMIT: 5.0,
  WEEKLY_LOSS_LIMIT: 10.0,
  MAX_DRAWDOWN_PCT: 15.0,
  DEFAULT_SL_PCT: 2.0,
  DEFAULT_TP_PCT: 4.0,
  TRAILING_STOP_PCT: 1.5,
  COOLDOWN_SECONDS: 300,
  MAX_DAILY_TRADES: 20,
  MAX_OPEN_TRADES: 5,
  MAX_SAME_PAIR_TRADES: 3,
  MIN_CONFIDENCE: 70,
  FLASH_CRASH_THRESHOLD: 10.0,
  SPREAD_LIMIT_PCT: 0.5,
  MAKER_FEE: 0.001,
  TAKER_FEE: 0.001,
  BREAKEVEN_ACTIVATE_PCT: 1.0,
  TRAILING_ACTIVATE_PCT: 1.5,
  CONSECUTIVE_LOSS_HALT: 3,
  API_DISCONNECT_TIMEOUT_MS: 120000,
};

export const BACKGROUNDS_TASKS = {
  SIGNAL_SCAN: 'SignalScanTask',
  PRICE_CHECK: 'PriceCheckTask',
  RISK_CHECK: 'RiskCheckTask',
  PORTFOLIO_SYNC: 'PortfolioSyncTask',
  ORDER_CHECK: 'OrderStatusCheckTask',
  STATE_SAVE: 'StateSaveTask',
};

export const FOREGROUND_INTERVALS = {
  SIGNAL_SCAN: 15000,
  PRICE_CHECK: 5000,
  RISK_CHECK: 30000,
  PORTFOLIO_SYNC: 60000,
  ORDER_CHECK: 10000,
  STATE_SAVE: 10000,
};

export const BACKGROUND_INTERVALS = {
  SIGNAL_SCAN: 60000,
  PRICE_CHECK: 15000,
  RISK_CHECK: 30000,
  PORTFOLIO_SYNC: 60000,
  ORDER_CHECK: 30000,
  STATE_SAVE: 30000,
};

export const THEME_COLORS = {
  BACKGROUND: '#0B0E11',
  CARD: '#1E2329',
  CARD_HOVER: '#2B3139',
  PRIMARY: '#F0B90B',
  BUY: '#0ECB81',
  SELL: '#F6465D',
  HOLD: '#F8A613',
  TEXT_PRIMARY: '#EAECEF',
  TEXT_SECONDARY: '#848E9C',
  TEXT_TERtiary: '#5E6673',
  BORDER: '#2B3139',
  SUCCESS: '#0ECB81',
  DANGER: '#F6465D',
  WARNING: '#F8A613',
  INFO: '#1E90FF',
  CHART_GRID: '#1E2329',
  GRADIENT_BUY_START: '#0ECB81',
  GRADIENT_BUY_END: '#0a9e64',
  GRADIENT_SELL_START: '#F6465D',
  GRADIENT_SELL_END: '#c93a4a',
};

export const APP_VERSION = '1.0.0';
export const DB_VERSION = 1;
export const DB_NAME = 'cryptosignal.db';
