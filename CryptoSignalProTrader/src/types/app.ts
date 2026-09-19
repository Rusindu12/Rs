export interface AppSettings {
  id: number;
  apiKeyEncrypted: string | null;
  apiSecretEncrypted: string | null;
  isTestnet: boolean;
  isAutoTrade: boolean;
  isPaperTrade: boolean;
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'custom';
  maxTradePct: number;
  dailyLossLimit: number;
  weeklyLossLimit: number;
  maxDrawdownPct: number;
  defaultSlPct: number;
  defaultTpPct: number;
  trailingStopPct: number;
  cooldownSeconds: number;
  maxDailyTrades: number;
  maxOpenTrades: number;
  minConfidence: number;
  strategy: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  autoStartOnBoot: boolean;
  biometricEnabled: boolean;
  pinCode: string | null;
  language: AppLanguage;
  createdAt: string;
  updatedAt: string;
}

export type AppLanguage = 'en' | 'si' | 'ta' | 'hi' | 'zh' | 'ja' | 'ko';

export interface AppState {
  isInitialized: boolean;
  isFirstLaunch: boolean;
  isAuthenticated: boolean;
  isBiometricEnabled: boolean;
  isBackgroundServiceRunning: boolean;
  backgroundServiceStartTime: string | null;
  activeScreen: string;
  networkStatus: 'online' | 'offline';
  lastSyncTime: string | null;
  errorMessage: string | null;
  apiConnectionStatus: 'connected' | 'disconnected' | 'testing' | 'error';
}

export interface Notification {
  id: number;
  type: 'signal' | 'trade' | 'price_alert' | 'system' | 'emergency' | 'pnl';
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

export interface AppLog {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  details: string | null;
  createdAt: string;
}

export interface EngineState {
  stateKey: string;
  stateValue: string;
  updatedAt: string;
}

export interface BotStatus {
  isActive: boolean;
  uptime: number;
  activePairs: number;
  activeTrades: number;
  signalsGenerated: number;
  tradesExecuted: number;
  currentPnl: number;
  lastSignalTime: string | null;
  lastTradeTime: string | null;
  serviceHealth: 'healthy' | 'degraded' | 'error';
  errors: string[];
}

export interface BacktestResult {
  id: number;
  symbol: string;
  timeframe: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  createdAt: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
}

export interface BacktestTrade {
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  entryTime: string;
  exitTime: string;
  duration: number;
  signalType: string;
}

export interface TaxExport {
  year: number;
  method: 'FIFO' | 'LIFO';
  trades: TaxTradeEntry[];
  totalGains: number;
  totalLosses: number;
  netGainLoss: number;
}

export interface TaxTradeEntry {
  date: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  fee: number;
  isLongTerm: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
  sendTradeAlerts: boolean;
  sendDailySummary: boolean;
  sendPanicAlerts: boolean;
  sendSignalAlerts: boolean;
}

export interface FeeRecord {
  id: number;
  tradeId: number;
  symbol: string;
  feeAmount: number;
  feeAsset: string;
  feeType: 'maker' | 'taker';
  timestamp: string;
}

export type TradingStrategy = 'aggressive' | 'moderate' | 'conservative' | 'custom';

export interface StrategyPreset {
  name: TradingStrategy;
  description: string;
  maxTradePct: number;
  dailyLossLimit: number;
  maxDrawdownPct: number;
  defaultSlPct: number;
  defaultTpPct: number;
  trailingStopPct: number;
  minConfidence: number;
  maxOpenTrades: number;
  cooldownSeconds: number;
}

export const STRATEGY_PRESETS: Record<TradingStrategy, StrategyPreset> = {
  aggressive: {
    name: 'aggressive',
    description: 'Higher risk, more trades, wider stops',
    maxTradePct: 5,
    dailyLossLimit: 8,
    maxDrawdownPct: 20,
    defaultSlPct: 3,
    defaultTpPct: 6,
    trailingStopPct: 2,
    minConfidence: 55,
    maxOpenTrades: 7,
    cooldownSeconds: 180,
  },
  moderate: {
    name: 'moderate',
    description: 'Balanced risk/reward, standard settings',
    maxTradePct: 3,
    dailyLossLimit: 5,
    maxDrawdownPct: 15,
    defaultSlPct: 2,
    defaultTpPct: 4,
    trailingStopPct: 1.5,
    minConfidence: 65,
    maxOpenTrades: 5,
    cooldownSeconds: 300,
  },
  conservative: {
    name: 'conservative',
    description: 'Lower risk, tighter stops, fewer trades',
    maxTradePct: 2,
    dailyLossLimit: 3,
    maxDrawdownPct: 10,
    defaultSlPct: 1.5,
    defaultTpPct: 3,
    trailingStopPct: 1,
    minConfidence: 75,
    maxOpenTrades: 3,
    cooldownSeconds: 600,
  },
  custom: {
    name: 'custom',
    description: 'Fully customizable parameters',
    maxTradePct: 3,
    dailyLossLimit: 5,
    maxDrawdownPct: 15,
    defaultSlPct: 2,
    defaultTpPct: 4,
    trailingStopPct: 1.5,
    minConfidence: 70,
    maxOpenTrades: 5,
    cooldownSeconds: 300,
  },
};
