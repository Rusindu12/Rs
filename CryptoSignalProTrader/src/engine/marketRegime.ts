import { MarketRegime } from '../types/signals';
import { calculateStandardDeviation } from '../utils/mathHelpers';

export interface MarketRegimeResult {
  regime: MarketRegime;
  adx: number;
  atrRatio: number;
  bbWidth: number;
  trendDirection: 'up' | 'down' | 'neutral';
  confidence: number;
}

export const detectMarketRegime = (
  closes: number[],
  highs: number[],
  lows: number[],
  adxValue: number,
  plusDI: number,
  minusDI: number,
  atrValue: number,
  avgATR: number,
  bbUpper: number,
  bbLower: number,
  bbMiddle: number,
  ema50: number
): MarketRegimeResult => {
  const currentPrice = closes[closes.length - 1];
  const atrRatio = avgATR > 0 ? atrValue / avgATR : 1;
  const bbWidth = bbMiddle > 0 ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0;

  const isHigherHighs = checkHigherHighs(highs.slice(-20));
  const isHigherLows = checkHigherLows(lows.slice(-20));
  const isLowerHighs = checkLowerHighs(highs.slice(-20));
  const isLowerLows = checkLowerLows(lows.slice(-20));

  let regime: MarketRegime;
  let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  let confidence = 50;

  if (adxValue > 25 && plusDI > minusDI && currentPrice > ema50 && isHigherHighs && isHigherLows) {
    regime = 'BULL';
    trendDirection = 'up';
    confidence = Math.min(95, 60 + adxValue * 0.5);
  } else if (adxValue > 25 && minusDI > plusDI && currentPrice < ema50 && isLowerHighs && isLowerLows) {
    regime = 'BEAR';
    trendDirection = 'down';
    confidence = Math.min(95, 60 + adxValue * 0.5);
  } else if (adxValue < 20 && atrRatio < 1.2) {
    regime = 'SIDEWAYS';
    trendDirection = 'neutral';
    confidence = Math.min(90, 50 + (20 - adxValue) * 2);
  } else if (atrRatio > 2 || bbWidth > 8) {
    regime = 'VOLATILE';
    trendDirection = currentPrice > closes[closes.length - 5] ? 'up' : 'down';
    confidence = Math.min(90, 50 + atrRatio * 10);
  } else if (adxValue > 20) {
    regime = plusDI > minusDI ? 'BULL' : 'BEAR';
    trendDirection = plusDI > minusDI ? 'up' : 'down';
    confidence = 40 + adxValue * 0.5;
  } else {
    regime = 'SIDEWAYS';
    trendDirection = 'neutral';
    confidence = 40;
  }

  return { regime, adx: adxValue, atrRatio, bbWidth, trendDirection, confidence };
};

const checkHigherHighs = (highs: number[]): boolean => {
  if (highs.length < 6) return false;
  const recent = Math.max(...highs.slice(-5));
  const older = Math.max(...highs.slice(0, 5));
  return recent > older;
};

const checkHigherLows = (lows: number[]): boolean => {
  if (lows.length < 6) return false;
  const recent = Math.min(...lows.slice(-5));
  const older = Math.min(...lows.slice(0, 5));
  return recent > older;
};

const checkLowerHighs = (highs: number[]): boolean => {
  if (highs.length < 6) return false;
  const recent = Math.max(...highs.slice(-5));
  const older = Math.max(...highs.slice(0, 5));
  return recent < older;
};

const checkLowerLows = (lows: number[]): boolean => {
  if (lows.length < 6) return false;
  const recent = Math.min(...lows.slice(-5));
  const older = Math.min(...lows.slice(0, 5));
  return recent < older;
};

export const getStrategyForRegime = (regime: MarketRegime): string => {
  switch (regime) {
    case 'BULL':
      return 'Trend Following (Long bias, momentum entries)';
    case 'BEAR':
      return 'Trend Following (Short bias, breakdown entries)';
    case 'SIDEWAYS':
      return 'Mean Reversion (Range trading, fade extremes)';
    case 'VOLATILE':
      return 'Reduced Position Size (Tight stops, wider targets)';
    default:
      return 'Balanced';
  }
};
