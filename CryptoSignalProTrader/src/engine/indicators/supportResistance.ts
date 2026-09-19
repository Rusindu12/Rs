import { SupportResistanceSignal, SignalType } from '../../types/signals';

export const calculatePivotPoints = (
  high: number,
  low: number,
  close: number
): { r3: number; r2: number; r1: number; pp: number; s1: number; s2: number; s3: number } => {
  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  const r2 = pp + (high - low);
  const s2 = pp - (high - low);
  const r3 = high + 2 * (pp - low);
  const s3 = low - 2 * (high - pp);
  return { r3, r2, r1, pp, s1, s2, s3 };
};

export const calculateFibonacciPivot = (
  high: number,
  low: number,
  close: number
): { r3: number; r2: number; r1: number; pp: number; s1: number; s2: number; s3: number } => {
  const pp = (high + low + close) / 3;
  const range = high - low;
  return {
    r3: pp + range * 1.0,
    r2: pp + range * 0.618,
    r1: pp + range * 0.382,
    pp,
    s1: pp - range * 0.382,
    s2: pp - range * 0.618,
    s3: pp - range * 1.0,
  };
};

export const findSwingHighs = (
  highs: number[],
  lookback: number = 5
): number[] => {
  const swings: number[] = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push(highs[i]);
  }
  return swings;
};

export const findSwingLows = (
  lows: number[],
  lookback: number = 5
): number[] => {
  const swings: number[] = [];
  for (let i = lookback; i < lows.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push(lows[i]);
  }
  return swings;
};

export const findClusterZones = (
  levels: number[],
  tolerance: number = 0.01
): number[] => {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[] = [];
  let clusterSum = sorted[0];
  let clusterCount = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i] - sorted[i - 1]) / sorted[i - 1];
    if (diff <= tolerance) {
      clusterSum += sorted[i];
      clusterCount++;
    } else {
      clusters.push(clusterSum / clusterCount);
      clusterSum = sorted[i];
      clusterCount = 1;
    }
  }
  clusters.push(clusterSum / clusterCount);
  return clusters;
};

export const calculateSupportResistance = (
  highs: number[],
  lows: number[],
  closes: number[]
): SupportResistanceSignal => {
  if (closes.length < 20) {
    return {
      support: [],
      resistance: [],
      nearestSupport: 0,
      nearestResistance: 0,
      pivotPoint: 0,
      fibonacciPivot: { r3: 0, r2: 0, r1: 0, pp: 0, s1: 0, s2: 0, s3: 0 },
      signal: 'HOLD',
    };
  }

  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const recentClose = closes[closes.length - 1];

  const standardPivot = calculatePivotPoints(recentHigh, recentLow, recentClose);
  const fibPivot = calculateFibonacciPivot(recentHigh, recentLow, recentClose);

  const swingHighs = findSwingHighs(highs, 3);
  const swingLows = findSwingLows(lows, 3);

  const allResistance = [...swingHighs, standardPivot.r1, standardPivot.r2, standardPivot.r3, fibPivot.r1, fibPivot.r2, fibPivot.r3]
    .filter(r => r > recentClose)
    .sort((a, b) => a - b);

  const allSupport = [...swingLows, standardPivot.s1, standardPivot.s2, standardPivot.s3, fibPivot.s1, fibPivot.s2, fibPivot.s3]
    .filter(s => s < recentClose)
    .sort((a, b) => b - a);

  const resistance = findClusterZones(allResistance, 0.005);
  const support = findClusterZones(allSupport, 0.005);

  const nearestResistance = resistance.length > 0 ? resistance[0] : recentHigh;
  const nearestSupport = support.length > 0 ? support[0] : recentLow;

  const distToResistance = (nearestResistance - recentClose) / recentClose;
  const distToSupport = (recentClose - nearestSupport) / recentClose;

  let score = 0;

  if (distToSupport < distToResistance) {
    score = 40 * (1 - distToSupport / (distToSupport + distToResistance + 0.001));
  } else {
    score = -40 * (1 - distToResistance / (distToSupport + distToResistance + 0.001));
  }

  const inLowerThird = (recentClose - nearestSupport) / (nearestResistance - nearestSupport + 0.001);
  if (inLowerThird < 0.33) score += 20;
  else if (inLowerThird > 0.67) score -= 20;

  if (support.length >= 2 && Math.abs(support[0] - support[1]) / support[1] < 0.01) score += 15;
  if (resistance.length >= 2 && Math.abs(resistance[0] - resistance[1]) / resistance[1] < 0.01) score -= 15;

  score = Math.max(-100, Math.min(100, score));

  return {
    support,
    resistance,
    nearestSupport,
    nearestResistance,
    pivotPoint: standardPivot.pp,
    fibonacciPivot: fibPivot,
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

export const getSRScore = (sr: SupportResistanceSignal, currentPrice: number): number => {
  if (sr.nearestSupport === 0 && sr.nearestResistance === 0) return 0;
  const distToResistance = (sr.nearestResistance - currentPrice) / currentPrice;
  const distToSupport = (currentPrice - sr.nearestSupport) / currentPrice;
  if (distToSupport < distToResistance) return 30 * (1 - distToSupport / 0.05);
  return -30 * (1 - distToResistance / 0.05);
};
