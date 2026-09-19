export type SignalType = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'HOLD' | 'WEAK_SELL' | 'SELL' | 'STRONG_SELL';

export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'VOLATILE';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface Signal {
  id: number;
  symbol: string;
  signalType: SignalType;
  score: number;
  confidence: number;
  marketRegime: MarketRegime;
  rsiValue: number;
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  bbUpper: number;
  bbLower: number;
  bbPercent: number;
  ema9: number;
  ema21: number;
  ema50: number;
  stochRsiK: number;
  stochRsiD: number;
  atrValue: number;
  adxValue: number;
  volumeRatio: number;
  timeframe: Timeframe;
  priceAtSignal: number;
  wasActedOn: boolean;
  outcome: string | null;
  outcomePnl: number | null;
  createdAt: string;
  multiTimeframeAlignment: TimeframeAlignment;
}

export interface TimeframeAlignment {
  '1m': SignalType | null;
  '5m': SignalType | null;
  '15m': SignalType | null;
  '1h': SignalType | null;
  '4h': SignalType | null;
  '1d': SignalType | null;
  alignmentScore: number;
  confirmingTimeframes: number;
}

export interface IndicatorScore {
  name: string;
  value: number;
  score: number;
  weight: number;
  weightedScore: number;
  signal: SignalType;
  description: string;
}

export interface SignalBreakdown {
  indicators: IndicatorScore[];
  totalScore: number;
  confidence: number;
  marketRegime: MarketRegime;
  signalType: SignalType;
  timeframe: Timeframe;
  timestamp: string;
}

export interface RSISignal {
  value: number;
  signal: SignalType;
  isOverbought: boolean;
  isOversold: boolean;
  divergence: 'bullish' | 'bearish' | 'none';
}

export interface MACDSignal {
  macdLine: number;
  signalLine: number;
  histogram: number;
  crossover: 'bullish' | 'bearish' | 'none';
  zeroLineCross: 'above' | 'below' | 'none';
  momentum: 'increasing' | 'decreasing' | 'neutral';
  signal: SignalType;
}

export interface BollingerSignal {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
  bandwidth: number;
  squeeze: boolean;
  signal: SignalType;
}

export interface EMASignal {
  ema9: number;
  ema21: number;
  ema50: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  goldenCross: boolean;
  deathCross: boolean;
  trendStrength: number;
  signal: SignalType;
}

export interface StochRSISignal {
  k: number;
  d: number;
  crossover: 'bullish' | 'bearish' | 'none';
  isOverbought: boolean;
  isOversold: boolean;
  signal: SignalType;
}

export interface VolumeSignal {
  vwap: number;
  volumeRatio: number;
  obv: number;
  obvTrend: 'up' | 'down' | 'flat';
  isVolumeSpike: boolean;
  signal: SignalType;
}

export interface SupportResistanceSignal {
  support: number[];
  resistance: number[];
  nearestSupport: number;
  nearestResistance: number;
  pivotPoint: number;
  fibonacciPivot: { r3: number; r2: number; r1: number; pp: number; s1: number; s2: number; s3: number };
  signal: SignalType;
}

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  reliability: number;
  barIndex: number;
}

export interface CandlestickSignal {
  patterns: CandlestickPattern[];
  dominantPattern: CandlestickPattern | null;
  signal: SignalType;
}

export interface ATRSignal {
  value: number;
  percentATR: number;
  isHighVolatility: boolean;
  suggestedStopLoss: number;
  signal: SignalType;
}

export interface ADXSignal {
  adx: number;
  plusDI: number;
  minusDI: number;
  trendStrength: 'strong' | 'moderate' | 'weak' | 'none';
  crossover: 'bullish' | 'bearish' | 'none';
  signal: SignalType;
}

export interface PriceAlert {
  id: number;
  symbol: string;
  condition: 'above' | 'below' | 'percent_change' | 'cross_indicator';
  targetPrice: number;
  currentPrice: number;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: string;
  triggeredAt: string | null;
  notificationSent: boolean;
}

export interface FearGreedIndex {
  value: number;
  classification: string;
  timestamp: string;
}

export interface CorrelationMatrix {
  pairs: string[];
  matrix: number[][];
  timestamp: string;
}

export interface ScanResult {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  signal: SignalType;
  score: number;
  confidence: number;
  regime: MarketRegime;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  isActive: boolean;
  customSl: number | null;
  customTp: number | null;
  customQtyPct: number | null;
  addedAt: string;
}

export interface IndicatorWeights {
  macd: number;
  rsi: number;
  bollinger: number;
  ema: number;
  stochRsi: number;
  volume: number;
  supportResistance: number;
  candlestick: number;
  atr: number;
  adx: number;
}

export const DEFAULT_INDICATOR_WEIGHTS: IndicatorWeights = {
  macd: 0.18,
  rsi: 0.14,
  bollinger: 0.12,
  ema: 0.14,
  stochRsi: 0.08,
  volume: 0.10,
  supportResistance: 0.08,
  candlestick: 0.04,
  atr: 0.06,
  adx: 0.06,
};
