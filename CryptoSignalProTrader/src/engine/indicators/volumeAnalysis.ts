import { VolumeSignal, SignalType } from '../../types/signals';
import Big from 'big.js';

export const calculateVWAP = (
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number => {
  if (closes.length === 0) return 0;
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVolume += volumes[i];
  }
  return cumulativeVolume === 0 ? 0 : cumulativeTPV / cumulativeVolume;
};

export const calculateOBV = (closes: number[], volumes: number[]): number[] => {
  if (closes.length < 2) return [0];
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv.push(obv[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obv.push(obv[i - 1] - volumes[i]);
    } else {
      obv.push(obv[i - 1]);
    }
  }
  return obv;
};

export const calculateVolumeAnalysis = (
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): VolumeSignal => {
  if (closes.length < 20) {
    return {
      vwap: 0,
      volumeRatio: 1,
      obv: 0,
      obvTrend: 'flat',
      isVolumeSpike: false,
      signal: 'HOLD',
    };
  }

  const vwap = calculateVWAP(highs, lows, closes, volumes);
  const obvValues = calculateOBV(closes, volumes);
  const currentOBV = obvValues[obvValues.length - 1];

  const avgVolume = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume === 0 ? 1 : currentVolume / avgVolume;
  const isVolumeSpike = volumeRatio > 2.0;

  const recentOBV = obvValues.slice(-10);
  const olderOBV = obvValues.slice(-20, -10);
  const recentAvgOBV = recentOBV.reduce((s, v) => s + v, 0) / recentOBV.length;
  const olderAvgOBV = olderOBV.reduce((s, v) => s + v, 0) / olderOBV.length;

  let obvTrend: 'up' | 'down' | 'flat' = 'flat';
  if (recentAvgOBV > olderAvgOBV * 1.05) obvTrend = 'up';
  else if (recentAvgOBV < olderAvgOBV * 0.95) obvTrend = 'down';

  const currentPrice = closes[closes.length - 1];
  let score = 0;

  if (currentPrice > vwap) score += 20;
  else score -= 20;

  if (obvTrend === 'up') score += 25;
  else if (obvTrend === 'down') score -= 25;

  if (isVolumeSpike) {
    const priceDirection = currentPrice > closes[closes.length - 2] ? 1 : -1;
    score += priceDirection * 30;
  }

  if (volumeRatio > 1.5) {
    const priceChange = (currentPrice - closes[closes.length - 2]) / closes[closes.length - 2];
    score += priceChange > 0 ? 15 : -15;
  }

  score = Math.max(-100, Math.min(100, score));

  return {
    vwap,
    volumeRatio,
    obv: currentOBV,
    obvTrend,
    isVolumeSpike,
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

export const getVolumeScore = (vol: VolumeSignal): number => {
  let score = 0;
  if (vol.obvTrend === 'up') score += 25;
  else if (vol.obvTrend === 'down') score -= 25;
  if (vol.isVolumeSpike) score += 20;
  if (vol.volumeRatio > 1.5) score += 10;
  return Math.max(-100, Math.min(100, score));
};
