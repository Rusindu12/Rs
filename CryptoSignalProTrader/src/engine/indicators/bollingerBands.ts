import { BollingerSignal, SignalType } from '../../types/signals';
import { calculateStandardDeviation } from '../../utils/mathHelpers';

export const calculateBollingerBands = (
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): BollingerSignal => {
  if (closes.length < period) {
    return { upper: 0, middle: 0, lower: 0, percentB: 0.5, bandwidth: 0, squeeze: false, signal: 'HOLD' };
  }

  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((sum, c) => sum + c, 0) / period;
  const stdDev = calculateStandardDeviation(recentCloses);
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;

  const currentPrice = closes[closes.length - 1];
  const percentB = upper === lower ? 0.5 : (currentPrice - lower) / (upper - lower);
  const bandwidth = middle === 0 ? 0 : ((upper - lower) / middle) * 100;

  const historicalBandwidths: number[] = [];
  for (let i = period; i <= closes.length; i++) {
    const window = closes.slice(i - period, i);
    const m = window.reduce((s, c) => s + c, 0) / period;
    const sd = calculateStandardDeviation(window);
    historicalBandwidths.push(m === 0 ? 0 : ((2 * multiplier * sd) / m) * 100);
  }

  const avgBandwidth = historicalBandwidths.length > 0
    ? historicalBandwidths.reduce((s, b) => s + b, 0) / historicalBandwidths.length
    : 0;
  const squeeze = bandwidth < avgBandwidth * 0.6;

  let score = 0;

  if (percentB > 1.0) {
    score = -70;
  } else if (percentB > 0.9) {
    score = -40;
  } else if (percentB > 0.8) {
    score = -15;
  } else if (percentB < 0.0) {
    score = 70;
  } else if (percentB < 0.1) {
    score = 40;
  } else if (percentB < 0.2) {
    score = 15;
  } else {
    score = (0.5 - percentB) * 80;
  }

  if (squeeze) {
    const priceDirection = closes[closes.length - 1] > closes[closes.length - 6] ? 1 : -1;
    score += priceDirection * 20;
  }

  score = Math.max(-100, Math.min(100, score));

  return {
    upper,
    middle,
    lower,
    percentB,
    bandwidth,
    squeeze,
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

export const getBollingerScore = (bb: BollingerSignal): number => {
  let score = 0;
  if (bb.percentB > 1.0) score = -70;
  else if (bb.percentB > 0.9) score = -40;
  else if (bb.percentB > 0.8) score = -15;
  else if (bb.percentB < 0.0) score = 70;
  else if (bb.percentB < 0.1) score = 40;
  else if (bb.percentB < 0.2) score = 15;
  else score = (0.5 - bb.percentB) * 80;
  return Math.max(-100, Math.min(100, score));
};
