import { MACDSignal, SignalType } from '../../types/signals';

export const calculateEMA = (data: number[], period: number): number[] => {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export const calculateMACD = (
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDSignal => {
  if (closes.length < slowPeriod + signalPeriod) {
    return {
      macdLine: 0,
      signalLine: 0,
      histogram: 0,
      crossover: 'none',
      zeroLineCross: 'none',
      momentum: 'neutral',
      signal: 'HOLD',
    };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = [];
  const startIdx = slowPeriod - 1;
  for (let i = startIdx; i < closes.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }

  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const currentHistogram = histogram[histogram.length - 1];
  const prevHistogram = histogram.length > 1 ? histogram[histogram.length - 2] : 0;
  const prevMACD = macdLine.length > 1 ? macdLine[macdLine.length - 2] : 0;
  const prevSignal = signalLine.length > 1 ? signalLine[signalLine.length - 2] : 0;

  let crossover: 'bullish' | 'bearish' | 'none' = 'none';
  if (prevMACD <= prevSignal && currentMACD > currentSignal) {
    crossover = 'bullish';
  } else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
    crossover = 'bearish';
  }

  let zeroLineCross: 'above' | 'below' | 'none' = 'none';
  if (prevMACD < 0 && currentMACD >= 0) {
    zeroLineCross = 'above';
  } else if (prevMACD > 0 && currentMACD <= 0) {
    zeroLineCross = 'below';
  }

  let momentum: 'increasing' | 'decreasing' | 'neutral' = 'neutral';
  if (currentHistogram > prevHistogram && currentHistogram > 0) {
    momentum = 'increasing';
  } else if (currentHistogram < prevHistogram && currentHistogram < 0) {
    momentum = 'decreasing';
  }

  let score = 0;

  if (crossover === 'bullish') score += 40;
  else if (crossover === 'bearish') score -= 40;

  if (zeroLineCross === 'above') score += 25;
  else if (zeroLineCross === 'below') score -= 25;

  if (momentum === 'increasing') score += 15;
  else if (momentum === 'decreasing') score -= 15;

  if (currentHistogram > 0) score += 10;
  else score -= 10;

  if (currentMACD > currentSignal) score += 10;
  else score -= 10;

  score = Math.max(-100, Math.min(100, score));

  return {
    macdLine: currentMACD,
    signalLine: currentSignal,
    histogram: currentHistogram,
    crossover,
    zeroLineCross,
    momentum,
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

export const getMACDScore = (macd: MACDSignal): number => {
  let score = 0;
  if (macd.crossover === 'bullish') score += 40;
  else if (macd.crossover === 'bearish') score -= 40;
  if (macd.zeroLineCross === 'above') score += 25;
  else if (macd.zeroLineCross === 'below') score -= 25;
  if (macd.momentum === 'increasing') score += 15;
  else if (macd.momentum === 'decreasing') score -= 15;
  if (macd.histogram > 0) score += 10;
  else score -= 10;
  if (macd.macdLine > macd.signalLine) score += 10;
  else score -= 10;
  return Math.max(-100, Math.min(100, score));
};
