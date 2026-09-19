import {
  Signal, SignalType, MarketRegime, Timeframe, IndicatorScore,
  SignalBreakdown, DEFAULT_INDICATOR_WEIGHTS, IndicatorWeights,
  TimeframeAlignment,
} from '../types/signals';
import { BinanceKline } from '../types/binance';
import { calculateRSI, getRSIScore } from './indicators/rsi';
import { calculateMACD, getMACDScore } from './indicators/macd';
import { calculateBollingerBands, getBollingerScore } from './indicators/bollingerBands';
import { calculateEMACrossover, getEMAScore } from './indicators/ema';
import { calculateStochasticRSI, getStochRSIScore } from './indicators/stochasticRSI';
import { calculateVolumeAnalysis, getVolumeScore } from './indicators/volumeAnalysis';
import { calculateSupportResistance, getSRScore } from './indicators/supportResistance';
import { detectCandlestickPatterns, getCandlestickScore } from './indicators/candlestickPatterns';
import { calculateATR, getATRScore } from './indicators/atr';
import { calculateADX, getADXScore } from './indicators/adx';
import { detectMarketRegime } from './marketRegime';
import { SIGNAL_THRESHOLDS } from '../utils/constants';

interface KlineData {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

export const parseKlines = (klines: BinanceKline[]): KlineData => ({
  opens: klines.map(k => parseFloat(k.open)),
  highs: klines.map(k => parseFloat(k.high)),
  lows: klines.map(k => parseFloat(k.low)),
  closes: klines.map(k => parseFloat(k.close)),
  volumes: klines.map(k => parseFloat(k.volume)),
});

export const generateSignal = (
  klines: BinanceKline[],
  timeframe: Timeframe,
  weights: IndicatorWeights = DEFAULT_INDICATOR_WEIGHTS,
  fearGreedIndex?: number
): SignalBreakdown => {
  const data = parseKlines(klines);
  const { closes, highs, lows, volumes, opens } = data;

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  const ema = calculateEMACrossover(closes);
  const stochRsi = calculateStochasticRSI(closes);
  const volume = calculateVolumeAnalysis(closes, highs, lows, volumes);
  const sr = calculateSupportResistance(highs, lows, closes);
  const candleData = closes.map((_, i) => ({
    open: opens[i],
    high: highs[i],
    low: lows[i],
    close: closes[i],
    volume: volumes[i],
  }));
  const candles = detectCandlestickPatterns(candleData);
  const atr = calculateATR(highs, lows, closes);
  const adx = calculateADX(highs, lows, closes);

  const adxData = calculateADX(highs, lows, closes);
  const atrData = calculateATR(highs, lows, closes);
  const avgATR = atrData.value;
  const currentPrice = closes[closes.length - 1];

  const regimeResult = detectMarketRegime(
    closes, highs, lows,
    adxData.adx, adxData.plusDI, adxData.minusDI,
    atrData.value, avgATR,
    bb.upper, bb.lower, bb.middle,
    ema.ema50
  );

  const indicators: IndicatorScore[] = [
    { name: 'RSI', value: rsi.value, score: getRSIScore(rsi), weight: weights.rsi, weightedScore: getRSIScore(rsi) * weights.rsi, signal: rsi.signal, description: `RSI: ${rsi.value.toFixed(1)} ${rsi.isOverbought ? '(Overbought)' : rsi.isOversold ? '(Oversold)' : ''}` },
    { name: 'MACD', value: macd.macdLine, score: getMACDScore(macd), weight: weights.macd, weightedScore: getMACDScore(macd) * weights.macd, signal: macd.signal, description: `MACD: ${macd.crossover} crossover, histogram: ${macd.histogram.toFixed(4)}` },
    { name: 'Bollinger', value: bb.percentB, score: getBollingerScore(bb), weight: weights.bollinger, weightedScore: getBollingerScore(bb) * weights.bollinger, signal: bb.signal, description: `%B: ${(bb.percentB * 100).toFixed(1)}% ${bb.squeeze ? '(Squeeze!)' : ''}` },
    { name: 'EMA', value: ema.ema9, score: getEMAScore(ema), weight: weights.ema, weightedScore: getEMAScore(ema) * weights.ema, signal: ema.signal, description: `Trend: ${ema.trend} ${ema.goldenCross ? '⬆ Golden Cross' : ema.deathCross ? '⬇ Death Cross' : ''}` },
    { name: 'StochRSI', value: stochRsi.k, score: getStochRSIScore(stochRsi), weight: weights.stochRsi, weightedScore: getStochRSIScore(stochRsi) * weights.stochRsi, signal: stochRsi.signal, description: `K: ${stochRsi.k.toFixed(1)} D: ${stochRsi.d.toFixed(1)} ${stochRsi.crossover}` },
    { name: 'Volume', value: volume.volumeRatio, score: getVolumeScore(volume), weight: weights.volume, weightedScore: getVolumeScore(volume) * weights.volume, signal: volume.signal, description: `Vol ratio: ${volume.volumeRatio.toFixed(2)}x ${volume.isVolumeSpike ? '(SPIKE!)' : ''} OBV: ${volume.obvTrend}` },
    { name: 'S/R', value: sr.nearestSupport, score: getSRScore(sr, currentPrice), weight: weights.supportResistance, weightedScore: getSRScore(sr, currentPrice) * weights.supportResistance, signal: sr.signal, description: `S: ${sr.nearestSupport.toFixed(2)} R: ${sr.nearestResistance.toFixed(2)}` },
    { name: 'Candles', value: candles.patterns.length, score: getCandlestickScore(candles), weight: weights.candlestick, weightedScore: getCandlestickScore(candles) * weights.candlestick, signal: candles.signal, description: candles.dominantPattern ? `${candles.dominantPattern.name} (${candles.dominantPattern.type})` : 'No pattern' },
    { name: 'ATR', value: atr.value, score: getATRScore(atr), weight: weights.atr, weightedScore: getATRScore(atr) * weights.atr, signal: atr.signal, description: `ATR: ${atr.value.toFixed(2)} (${atr.percentATR.toFixed(2)}%) ${atr.isHighVolatility ? '(HIGH VOL)' : ''}` },
    { name: 'ADX', value: adx.adx, score: getADXScore(adx), weight: weights.adx, weightedScore: getADXScore(adx) * weights.adx, signal: adx.signal, description: `ADX: ${adx.adx.toFixed(1)} +DI: ${adx.plusDI.toFixed(1)} -DI: ${adx.minusDI.toFixed(1)} ${adx.trendStrength}` },
  ];

  let totalScore = 0;
  for (const ind of indicators) {
    totalScore += ind.weightedScore;
  }

  if (fearGreedIndex !== undefined) {
    if (fearGreedIndex < 20) totalScore += 8;
    else if (fearGreedIndex < 30) totalScore += 4;
    else if (fearGreedIndex > 80) totalScore -= 8;
    else if (fearGreedIndex > 70) totalScore -= 4;
  }

  totalScore = Math.max(-100, Math.min(100, totalScore));

  const agreementCount = indicators.filter(i => {
    if (totalScore > 0) return i.score > 0;
    if (totalScore < 0) return i.score < 0;
    return Math.abs(i.score) < 15;
  }).length;

  const agreementPct = (agreementCount / indicators.length) * 100;
  const adxConfidence = Math.min(adx.adx / 50, 1) * 30;
  const volConfidence = Math.min(volume.volumeRatio / 2, 1) * 20;
  const confidence = Math.min(95, Math.max(10, agreementPct * 0.5 + adxConfidence + volConfidence));

  const signalType = mapScoreToSignal(totalScore);

  return {
    indicators,
    totalScore,
    confidence,
    marketRegime: regimeResult.regime,
    signalType,
    timeframe,
    timestamp: new Date().toISOString(),
  };
};

export const mapScoreToSignal = (score: number): SignalType => {
  if (score > SIGNAL_THRESHOLDS.STRONG_BUY) return 'STRONG_BUY';
  if (score > SIGNAL_THRESHOLDS.BUY) return 'BUY';
  if (score > SIGNAL_THRESHOLDS.WEAK_BUY) return 'WEAK_BUY';
  if (score >= SIGNAL_THRESHOLDS.HOLD_LOWER) return 'HOLD';
  if (score >= SIGNAL_THRESHOLDS.WEAK_SELL) return 'WEAK_SELL';
  if (score >= SIGNAL_THRESHOLDS.SELL) return 'SELL';
  return 'STRONG_SELL';
};

export const generateMultiTimeframeSignal = (
  timeframeSignals: Map<Timeframe, SignalBreakdown>
): { signal: SignalType; alignmentScore: number; confirmingTimeframes: number } => {
  const signals = Array.from(timeframeSignals.values());
  if (signals.length === 0) return { signal: 'HOLD', alignmentScore: 0, confirmingTimeframes: 0 };

  const primarySignal = signals[0].signalType;
  const isBuySignal = ['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(primarySignal);
  const isSellSignal = ['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(primarySignal);

  let confirming = 0;
  for (const s of signals) {
    if (isBuySignal && ['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(s.signalType)) confirming++;
    else if (isSellSignal && ['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(s.signalType)) confirming++;
    else if (!isBuySignal && !isSellSignal && s.signalType === 'HOLD') confirming++;
  }

  const alignmentScore = (confirming / signals.length) * 100;
  return { signal: primarySignal, alignmentScore, confirmingTimeframes: confirming };
};

export const buildTimeframeAlignment = (
  signals: Map<Timeframe, SignalBreakdown>
): TimeframeAlignment => {
  const get = (tf: Timeframe) => signals.get(tf)?.signalType || null;
  const all = Array.from(signals.values());
  const primary = all[0]?.signalType || 'HOLD';
  const isBuy = ['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(primary);
  const isSell = ['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(primary);
  let confirming = 0;
  for (const s of all) {
    if (isBuy && ['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(s.signalType)) confirming++;
    else if (isSell && ['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(s.signalType)) confirming++;
    else if (!isBuy && !isSell && s.signalType === 'HOLD') confirming++;
  }
  return {
    '1m': get('1m'), '5m': get('5m'), '15m': get('15m'),
    '1h': get('1h'), '4h': get('4h'), '1d': get('1d'),
    alignmentScore: all.length > 0 ? (confirming / all.length) * 100 : 0,
    confirmingTimeframes: confirming,
  };
};
