import { CandlestickPattern, CandlestickSignal, SignalType } from '../../types/signals';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const isDoji = (c: Candle): boolean => {
  const bodySize = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  return range > 0 && bodySize / range < 0.1;
};

export const isHammer = (c: Candle): boolean => {
  const bodySize = Math.abs(c.close - c.open);
  const lowerShadow = Math.min(c.open, c.close) - c.low;
  const upperShadow = c.high - Math.max(c.open, c.close);
  const range = c.high - c.low;
  return range > 0 && lowerShadow > 2 * bodySize && upperShadow < bodySize * 0.3;
};

export const isInvertedHammer = (c: Candle): boolean => {
  const bodySize = Math.abs(c.close - c.open);
  const lowerShadow = Math.min(c.open, c.close) - c.low;
  const upperShadow = c.high - Math.max(c.open, c.close);
  const range = c.high - c.low;
  return range > 0 && upperShadow > 2 * bodySize && lowerShadow < bodySize * 0.3;
};

export const isBullishEngulfing = (prev: Candle, curr: Candle): boolean => {
  return prev.close < prev.open && curr.close > curr.open &&
    curr.open <= prev.close && curr.close >= prev.open;
};

export const isBearishEngulfing = (prev: Candle, curr: Candle): boolean => {
  return prev.close > prev.open && curr.close < curr.open &&
    curr.open >= prev.close && curr.close <= prev.open;
};

export const isMorningStar = (c1: Candle, c2: Candle, c3: Candle): boolean => {
  const body1 = c1.close - c1.open;
  const body2 = Math.abs(c2.close - c2.open);
  const body3 = c3.close - c3.open;
  return body1 < 0 && Math.abs(body1) > body2 * 3 && body3 > 0 &&
    c3.close > (c1.open + c1.close) / 2;
};

export const isEveningStar = (c1: Candle, c2: Candle, c3: Candle): boolean => {
  const body1 = c1.close - c1.open;
  const body2 = Math.abs(c2.close - c2.open);
  const body3 = c3.close - c3.open;
  return body1 > 0 && body1 > body2 * 3 && body3 < 0 &&
    c3.close < (c1.open + c1.close) / 2;
};

export const isThreeWhiteSoldiers = (c1: Candle, c2: Candle, c3: Candle): boolean => {
  return c1.close > c1.open && c2.close > c2.open && c3.close > c3.open &&
    c2.open > c1.open && c2.close > c1.close &&
    c3.open > c2.open && c3.close > c2.close;
};

export const isThreeBlackCrows = (c1: Candle, c2: Candle, c3: Candle): boolean => {
  return c1.close < c1.open && c2.close < c2.open && c3.close < c3.open &&
    c2.open < c1.open && c2.close < c1.close &&
    c3.open < c2.open && c3.close < c2.close;
};

export const isPiercingLine = (prev: Candle, curr: Candle): boolean => {
  const midPoint = (prev.open + prev.close) / 2;
  return prev.close < prev.open && curr.close > curr.open &&
    curr.open < prev.low && curr.close > midPoint;
};

export const isDarkCloudCover = (prev: Candle, curr: Candle): boolean => {
  const midPoint = (prev.open + prev.close) / 2;
  return prev.close > prev.open && curr.close < curr.open &&
    curr.open > prev.high && curr.close < midPoint;
};

export const detectCandlestickPatterns = (candles: Candle[]): CandlestickSignal => {
  const patterns: CandlestickPattern[] = [];
  if (candles.length < 3) return { patterns, dominantPattern: null, signal: 'HOLD' };

  const len = candles.length;
  const c = candles[len - 1];
  const p = candles[len - 2];
  const pp = candles[len - 3];

  if (isDoji(c)) patterns.push({ name: 'Doji', type: 'neutral', reliability: 0.5, barIndex: len - 1 });
  if (isHammer(c)) patterns.push({ name: 'Hammer', type: 'bullish', reliability: 0.7, barIndex: len - 1 });
  if (isInvertedHammer(c)) patterns.push({ name: 'Inverted Hammer', type: 'bullish', reliability: 0.6, barIndex: len - 1 });
  if (isBullishEngulfing(p, c)) patterns.push({ name: 'Bullish Engulfing', type: 'bullish', reliability: 0.8, barIndex: len - 1 });
  if (isBearishEngulfing(p, c)) patterns.push({ name: 'Bearish Engulfing', type: 'bearish', reliability: 0.8, barIndex: len - 1 });
  if (isMorningStar(pp, p, c)) patterns.push({ name: 'Morning Star', type: 'bullish', reliability: 0.85, barIndex: len - 1 });
  if (isEveningStar(pp, p, c)) patterns.push({ name: 'Evening Star', type: 'bearish', reliability: 0.85, barIndex: len - 1 });
  if (isThreeWhiteSoldiers(pp, p, c)) patterns.push({ name: 'Three White Soldiers', type: 'bullish', reliability: 0.8, barIndex: len - 1 });
  if (isThreeBlackCrows(pp, p, c)) patterns.push({ name: 'Three Black Crows', type: 'bearish', reliability: 0.8, barIndex: len - 1 });
  if (isPiercingLine(p, c)) patterns.push({ name: 'Piercing Line', type: 'bullish', reliability: 0.7, barIndex: len - 1 });
  if (isDarkCloudCover(p, c)) patterns.push({ name: 'Dark Cloud Cover', type: 'bearish', reliability: 0.7, barIndex: len - 1 });

  let dominantPattern: CandlestickPattern | null = null;
  if (patterns.length > 0) {
    dominantPattern = patterns.reduce((best, p) => p.reliability > best.reliability ? p : best);
  }

  let score = 0;
  for (const pattern of patterns) {
    const weight = pattern.reliability * 40;
    if (pattern.type === 'bullish') score += weight;
    else if (pattern.type === 'bearish') score -= weight;
  }

  score = Math.max(-100, Math.min(100, score));

  return {
    patterns,
    dominantPattern,
    signal: mapScoreToSignal(score),
  };
};

const mapScoreToSignal = (score: number): SignalType => {
  if (score >= 65) return 'STRONG_BUY';
  if (score >= 35) return 'BUY';
  if (score >= 15) return 'WEAK_BUY';
  if (score >= -15) return 'HOLD';
  if (score >= -35) return 'WEAK_SELL';
  if (score >= -65) return 'SELL';
  return 'STRONG_SELL';
};

export const getCandlestickScore = (signal: CandlestickSignal): number => {
  let score = 0;
  for (const pattern of signal.patterns) {
    const weight = pattern.reliability * 40;
    if (pattern.type === 'bullish') score += weight;
    else if (pattern.type === 'bearish') score -= weight;
  }
  return Math.max(-100, Math.min(100, score));
};
