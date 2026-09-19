import { ATRSignal, SignalType } from '../../types/signals';

export const calculateATR = (
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ATRSignal => {
  if (highs.length < period + 1) {
    return { value: 0, percentATR: 0, isHighVolatility: false, suggestedStopLoss: 0, signal: 'HOLD' };
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  const currentPrice = closes[closes.length - 1];
  const percentATR = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  const historicalATRs: number[] = [];
  let tempATR = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  historicalATRs.push(tempATR);
  for (let i = period; i < trueRanges.length; i++) {
    tempATR = (tempATR * (period - 1) + trueRanges[i]) / period;
    historicalATRs.push(tempATR);
  }

  const avgATR = historicalATRs.reduce((s, v) => s + v, 0) / historicalATRs.length;
  const isHighVolatility = atr > avgATR * 2;

  const suggestedStopLoss = atr * 2;

  let score = 0;
  if (isHighVolatility) {
    score = -20;
  } else if (atr < avgATR * 0.5) {
    score = 10;
  }

  score = Math.max(-100, Math.min(100, score));

  return {
    value: atr,
    percentATR,
    isHighVolatility,
    suggestedStopLoss,
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

export const getATRScore = (atr: ATRSignal): number => {
  if (atr.isHighVolatility) return -20;
  if (atr.percentATR < 1) return 10;
  return 0;
};
