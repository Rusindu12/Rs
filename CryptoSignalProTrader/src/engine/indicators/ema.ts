import { EMASignal, SignalType } from '../../types/signals';

export const calculateEMA = (data: number[], period: number): number[] => {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export const calculateEMACrossover = (
  closes: number[],
  fastPeriod: number = 9,
  midPeriod: number = 21,
  slowPeriod: number = 50
): EMASignal => {
  if (closes.length < slowPeriod) {
    return {
      ema9: 0, ema21: 0, ema50: 0,
      trend: 'neutral', goldenCross: false, deathCross: false,
      trendStrength: 0, signal: 'HOLD',
    };
  }

  const ema9 = calculateEMA(closes, fastPeriod);
  const ema21 = calculateEMA(closes, midPeriod);
  const ema50 = calculateEMA(closes, slowPeriod);

  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];
  const currentEma50 = ema50[ema50.length - 1];
  const prevEma9 = ema9.length > 1 ? ema9[ema9.length - 2] : currentEma9;
  const prevEma21 = ema21.length > 1 ? ema21[ema21.length - 2] : currentEma21;

  const goldenCross = prevEma9 <= prevEma21 && currentEma9 > currentEma21;
  const deathCross = prevEma9 >= prevEma21 && currentEma9 < currentEma21;

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentEma9 > currentEma21 && currentEma21 > currentEma50) {
    trend = 'bullish';
  } else if (currentEma9 < currentEma21 && currentEma21 < currentEma50) {
    trend = 'bearish';
  }

  const currentPrice = closes[closes.length - 1];
  const emaSpread = ((currentEma9 - currentEma50) / currentEma50) * 100;
  const trendStrength = Math.min(Math.abs(emaSpread) / 5, 1) * 100;

  let score = 0;

  if (trend === 'bullish') score += 30;
  else if (trend === 'bearish') score -= 30;

  if (goldenCross) score += 40;
  else if (deathCross) score -= 40;

  if (currentPrice > currentEma9) score += 10;
  else score -= 10;

  if (currentPrice > currentEma50) score += 10;
  else score -= 10;

  if (currentEma9 > currentEma21) score += 10;
  else score -= 10;

  score = Math.max(-100, Math.min(100, score));

  return {
    ema9: currentEma9,
    ema21: currentEma21,
    ema50: currentEma50,
    trend,
    goldenCross,
    deathCross,
    trendStrength,
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

export const getEMAScore = (ema: EMASignal): number => {
  let score = 0;
  if (ema.trend === 'bullish') score += 30;
  else if (ema.trend === 'bearish') score -= 30;
  if (ema.goldenCross) score += 40;
  else if (ema.deathCross) score -= 40;
  score += ema.trendStrength * 0.3 * (ema.trend === 'bullish' ? 1 : ema.trend === 'bearish' ? -1 : 0);
  return Math.max(-100, Math.min(100, score));
};
