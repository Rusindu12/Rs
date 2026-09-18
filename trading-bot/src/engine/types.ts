import type { Candle } from '../indicators/indicators';
import type { SignalStrength, Timeframe } from '../config';

/** Full market snapshot for one symbol across all engine timeframes. */
export interface SymbolMarketData {
  symbol: string;
  /** Keyed by timeframe. */
  candles: Partial<Record<Timeframe, Candle[]>>;
  /** Latest traded price (from the websocket ticker when available). */
  lastPrice?: number;
  /** 24h quote volume (informational). */
  quoteVolume24h?: number;
}

export interface IndicatorSnapshot {
  price: number;
  rsi: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  stochK: number;
  stochD: number;
  atr: number;
  atrPct: number;
  volume: number;
  avgVolume: number;
  vwap: number;
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    priceAboveCloud: boolean | null;
  };
  fib: { high: number; low: number; nearest: number; distancePct: number };
  volumeProfile: { poc: number; vah: number; val: number };
}

/** One scored rule contributing to the final signal. */
export interface SignalFactor {
  name: string;
  /** Human-readable value summary, e.g. "RSI 27.4". */
  detail: string;
  /** Points contributed (positive = bullish, negative = bearish). */
  score: number;
  informational?: boolean;
}

export interface Signal {
  symbol: string;
  action: SignalStrength;
  score: number;
  /** 0-100 confidence in the emitted action (equals |score| clamped). */
  confidence: number;
  factors: SignalFactor[];
  /** Per-timeframe scores backing the multi-timeframe confluence factor. */
  timeframes: { tf: Timeframe; score: number }[];
  price: number;
  computedAt: number;
  /** AI v2 structured context (patterns, regime, divergences, targets). */
  extras: {
    /** Detected candlestick pattern name, if any. */
    pattern?: string;
    /** RSI divergence direction on the primary timeframe. */
    divergence?: 'bullish' | 'bearish' | null;
    /** ADX-based market regime. */
    regime: 'trending' | 'ranging';
    adx: number;
    /** ATR-derived expected move (±%) over the next few candles. */
    expectedMovePct: number;
    atrPct: number;
    /** Short S/R position summary, e.g. "at value-area support". */
    srBias: string;
  };
}

export type TradeSide = 'BUY' | 'SELL';

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG';
  qty: number;
  entryPrice: number;
  openedAt: number;
  stopLoss: number;
  takeProfit: number;
  tradeAmountUsdt: number;
  mode: 'paper' | 'live';
  signalAtEntry: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: TradeSide;
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  openedAt: number;
  closedAt?: number;
  pnlUsdt?: number;
  pnlPct?: number;
  mode: 'paper' | 'live';
  status: 'OPEN' | 'CLOSED';
  /** Why the trade was opened/closed, e.g. "STRONG_BUY score 78" or "TAKE_PROFIT". */
  reason: string;
  feeUsdt?: number;
}

export interface BotConfig {
  enabled: boolean;
  symbols: string[];
  tradeAmountUsdt: number;
  maxOpenTrades: number;
  stopLossPct: number;
  takeProfitPct: number;
  dailyLossLimitPct: number;
  /** Minimum signal strength required to open a new position. */
  minSignal: SignalStrength;
  pollIntervalMs: number;
  /** How eagerly the bot opens new positions (chill=BUY only, normal≥20, turbo≥12). */
  tradeMode: TradeMode;
  /** Widen SL/TP with ATR volatility so volatile coins aren't clipped. */
  useAtrStops: boolean;
  /** Scale position size between 0.75×–1× by signal confidence. */
  confidenceSizing: boolean;
}

export interface Balances {
  usdtFree: number;
  assetFree: Record<string, number>;
  equityUsdt: number;
}

/** Abstraction over "place market orders" so paper and live modes share one engine. */
export interface TradingProvider {
  mode: 'paper' | 'live';
  getBalances(): Promise<Balances>;
  /** Market buy with `quoteQty` USDT; returns filled quantity (base asset). */
  marketBuy(symbol: string, quoteQty: number): Promise<{ qty: number; price: number; feeUsdt: number }>;
  /** Market sell `qty` of the base asset; returns proceeds + fee. */
  marketSell(symbol: string, qty: number): Promise<{ price: number; proceedsUsdt: number; feeUsdt: number }>;
  cancelAllOrders(symbol: string): Promise<void>;
}

export const ACTION_SCORE: Record<SignalStrength, number> = {
  STRONG_BUY: 3,
  BUY: 2,
  HOLD: 1,
  SELL: 0,
  STRONG_SELL: -1,
};

/** True when `a` is at least as strong a buy signal as `b`. */
export type TradeMode = 'chill' | 'normal' | 'turbo';
/** Minimum composite score for a BUY entry under each trade mode. */
export const TRADE_MODE_FLOOR: Record<TradeMode, number> = { chill: 30, normal: 20, turbo: 8 };

/** Entry gate shared by the bot and the tests. */
export function shouldEnter(score: number, action: SignalStrength, mode: TradeMode, minSignal: SignalStrength): boolean {
  if (action === 'SELL' || action === 'STRONG_SELL') return false;
  if (mode === 'chill') return atLeastBuy(action, minSignal);
  return score >= TRADE_MODE_FLOOR[mode];
}

export function atLeastBuy(action: SignalStrength, min: SignalStrength): boolean {
  return ACTION_SCORE[action] >= ACTION_SCORE[min];
}
