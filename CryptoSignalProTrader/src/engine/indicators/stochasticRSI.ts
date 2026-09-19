import { StochRSISignal, SignalType } from '../../types/signals';

export const calculateStochasticRSI = (
  closes: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kPeriod: number = 3,
  dPeriod: number = 3
): StochRSISignal => {
  if (closes.length < rsiPeriod + stochPeriod + dPeriod) {
    return { k: 50, d: 50, crossover: 'none', isOverbought: false, isOversold: false, signal: 'HOLD' };
  }

  const rsiValues = computeRSIArray(closes, rsiPeriod);

  if (rsiValues.length < stochPeriod + dPeriod) {
    return { k: 50, d: 50, crossover: 'none', isOverbought: false, isOversold: false, signal: 'HOLD' };
  }

  const stochRsiValues: number[] = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    const range = maxRSI - minRSI;
    stochRsiValues.push(range === 0 ? 50 : ((rsiValues[i] - minRSI) / range) * 100);
  }

  const kValues = computeSMA(stochRsiValues, kPeriod);
  const dValues = computeSMA(kValues, dPeriod);

  const currentK = kValues[kValues.length - 1];
  const currentD = dValues[dValues.length - 1];
  const prevK = kValues.length > 1 ? kValues[kValues.length - 2] : currentK;
  const prevD = dValues.length > 1 ? dValues[dValues.length - 2] : currentD;

  let crossover: 'bullish' | 'bearish' | 'none' = 'none';
  if (prevK <= prevD && currentK > currentD) crossover = 'bullish';
  else if (prevK >= prevD && currentK < currentD) crossover = 'bearish';

  const isOverbought = currentK > 80 && currentD > 80;
  const isOversold = currentK < 20 && currentD < 20;

  let score = 0;

  if (crossover === 'bullish' && isOversold) score = 80;
  else if (crossover === 'bearish' && isOverbought) score = -80;
  else if (crossover === 'bullish') score = 40;
  else if (crossover === 'bearish') score = -40;

  if (currentK < 20) score += 20;
  else if (currentK > 80) score -= 20;
  else score += (50 - currentK) * 0.5;

  if (currentK > currentD) score += 10;
  else score -= 10;

  score = Math.max(-100, Math.min(100, score));

  return {
    k: currentK,
    d: currentD,
    crossover,
    isOverbought,
    isOversold,
    signal: mapScoreToSignal(score),
  };
};

const computeRSIArray = (closes: number[], period: number): number[] => {
  const rsiValues: number[] = [];
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

  const firstRSI = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = 0; i < period; i++) rsiValues.push(firstRSI);

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  return rsiValues;
};

const computeSMA = (data: number[], period: number): number[] => {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result.push(sum / period);
  }
  return result;
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

export const getStochRSIScore = (stoch: StochRSISignal): number => {
  let score = 0;
  if (stoch.crossover === 'bullish' && stoch.isOversold) score = 80;
  else if (stoch.crossover === 'bearish' && stoch.isOverbought) score = -80;
  else if (stoch.crossover === 'bullish') score = 40;
  else if (stoch.crossover === 'bearish') score = -40;
  if (stoch.k < 20) score += 20;
  else if (stoch.k > 80) score -= 20;
  if (stoch.k > stoch.d) score += 10;
  else score -= 10;
  return Math.max(-100, Math.min(100, score));
};
