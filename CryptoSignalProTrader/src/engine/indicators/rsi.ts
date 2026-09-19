import { RSISignal, SignalType } from '../../types/signals';

export const calculateRSI = (closes: number[], period: number = 14): RSISignal => {
  if (closes.length < period + 1) {
    return { value: 50, signal: 'HOLD', isOverbought: false, isOversold: false, divergence: 'none' };
  }

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  const isOverbought = rsi > 70;
  const isOversold = rsi < 30;

  const divergence = detectRSIDivergence(closes, period);

  let signal: SignalType = 'HOLD';
  let score = 0;

  if (rsi < 20) {
    signal = 'STRONG_BUY';
    score = 90;
  } else if (rsi < 30) {
    signal = 'BUY';
    score = 60 + (30 - rsi) * 3;
  } else if (rsi < 40) {
    signal = 'WEAK_BUY';
    score = 20 + (40 - rsi) * 2;
  } else if (rsi <= 60) {
    signal = 'HOLD';
    score = 0;
  } else if (rsi <= 70) {
    signal = 'WEAK_SELL';
    score = -20 - (rsi - 60) * 2;
  } else if (rsi <= 80) {
    signal = 'SELL';
    score = -60 - (rsi - 70) * 3;
  } else {
    signal = 'STRONG_SELL';
    score = -90;
  }

  if (divergence === 'bullish') score += 15;
  if (divergence === 'bearish') score -= 15;

  return {
    value: rsi,
    signal: mapScoreToSignal(score),
    isOverbought,
    isOversold,
    divergence,
  };
};

const detectRSIDivergence = (closes: number[], period: number): 'bullish' | 'bearish' | 'none' => {
  if (closes.length < period * 3) return 'none';

  const rsiValues: number[] = [];
  const windowSize = 20;

  for (let i = windowSize; i < closes.length; i++) {
    const window = closes.slice(i - windowSize, i);
    const changes: number[] = [];
    for (let j = 1; j < window.length; j++) {
      changes.push(window[j] - window[j - 1]);
    }
    let gain = 0;
    let loss = 0;
    for (const change of changes) {
      if (change > 0) gain += change;
      else loss += Math.abs(change);
    }
    gain /= changes.length;
    loss /= changes.length;
    const rs = loss === 0 ? 100 : gain / loss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  if (rsiValues.length < 20) return 'none';

  const mid = Math.floor(rsiValues.length / 2);
  const recentPrices = closes.slice(-20);
  const olderPrices = closes.slice(-(20 + mid), -mid);

  const recentPriceLow = Math.min(...recentPrices);
  const olderPriceLow = Math.min(...olderPrices);
  const recentRSILow = Math.min(...rsiValues.slice(-20));
  const olderRSILow = Math.min(...rsiValues.slice(0, 20));

  if (recentPriceLow < olderPriceLow && recentRSILow > olderRSILow) {
    return 'bullish';
  }

  const recentPriceHigh = Math.max(...recentPrices);
  const olderPriceHigh = Math.max(...olderPrices);
  const recentRSIHigh = Math.max(...rsiValues.slice(-20));
  const olderRSIHigh = Math.max(...rsiValues.slice(0, 20));

  if (recentPriceHigh > olderPriceHigh && recentRSIHigh < olderRSIHigh) {
    return 'bearish';
  }

  return 'none';
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

export const getRSIScore = (rsi: RSISignal): number => {
  const v = rsi.value;
  if (v < 20) return 90;
  if (v < 30) return 60 + (30 - v) * 3;
  if (v < 40) return 20 + (40 - v) * 2;
  if (v <= 60) return 0;
  if (v <= 70) return -20 - (v - 60) * 2;
  if (v <= 80) return -60 - (v - 70) * 3;
  return -90;
};
