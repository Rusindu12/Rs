import { ADXSignal, SignalType } from '../../types/signals';

export const calculateADX = (
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXSignal => {
  if (highs.length < period * 2 + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'none', crossover: 'none', signal: 'HOLD' };
  }

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);

    const plusDM = highs[i] - highs[i - 1];
    const minusDM = lows[i - 1] - lows[i];
    plusDMs.push(plusDM > minusDM && plusDM > 0 ? plusDM : 0);
    minusDMs.push(minusDM > plusDM && minusDM > 0 ? minusDM : 0);
  }

  let smoothedTR = trueRanges.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((s, v) => s + v, 0);

  const diPlusValues: number[] = [];
  const diMinusValues: number[] = [];
  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trueRanges[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    const diPlus = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const diMinus = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    diPlusValues.push(diPlus);
    diMinusValues.push(diMinus);

    const diSum = diPlus + diMinus;
    const dx = diSum > 0 ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) {
    return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'none', crossover: 'none', signal: 'HOLD' };
  }

  let adx = dxValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  const currentPlusDI = diPlusValues[diPlusValues.length - 1];
  const currentMinusDI = diMinusValues[diMinusValues.length - 1];
  const prevPlusDI = diPlusValues[diPlusValues.length - 2];
  const prevMinusDI = diMinusValues[diMinusValues.length - 2];

  let trendStrength: 'strong' | 'moderate' | 'weak' | 'none' = 'none';
  if (adx > 40) trendStrength = 'strong';
  else if (adx > 25) trendStrength = 'moderate';
  else if (adx > 20) trendStrength = 'weak';

  let crossover: 'bullish' | 'bearish' | 'none' = 'none';
  if (prevPlusDI <= prevMinusDI && currentPlusDI > currentMinusDI) crossover = 'bullish';
  else if (prevPlusDI >= prevMinusDI && currentPlusDI < currentMinusDI) crossover = 'bearish';

  let score = 0;

  if (crossover === 'bullish') score += 35;
  else if (crossover === 'bearish') score -= 35;

  if (currentPlusDI > currentMinusDI) score += 20;
  else score -= 20;

  if (adx > 25) {
    const diDiff = (currentPlusDI - currentMinusDI) / 100;
    score += diDiff * 30 * (adx / 50);
  }

  score = Math.max(-100, Math.min(100, score));

  return {
    adx,
    plusDI: currentPlusDI,
    minusDI: currentMinusDI,
    trendStrength,
    crossover,
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

export const getADXScore = (adx: ADXSignal): number => {
  let score = 0;
  if (adx.crossover === 'bullish') score += 35;
  else if (adx.crossover === 'bearish') score -= 35;
  if (adx.plusDI > adx.minusDI) score += 20;
  else score -= 20;
  if (adx.adx > 25) {
    const diDiff = (adx.plusDI - adx.minusDI) / 100;
    score += diDiff * 30 * (adx.adx / 50);
  }
  return Math.max(-100, Math.min(100, score));
};
