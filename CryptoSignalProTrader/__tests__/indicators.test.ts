import { calculateRSI } from '../src/engine/indicators/rsi';
import { calculateMACD } from '../src/engine/indicators/macd';
import { calculateBollingerBands } from '../src/engine/indicators/bollingerBands';
import { calculateEMA, calculateEMACrossover } from '../src/engine/indicators/ema';
import { calculateStochasticRSI } from '../src/engine/indicators/stochasticRSI';
import { calculateATR } from '../src/engine/indicators/atr';
import { calculateADX } from '../src/engine/indicators/adx';

const generatePrices = (count: number, start: number = 100, volatility: number = 0.02): number[] => {
  const prices: number[] = [start];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility * prices[i - 1];
    prices.push(prices[i - 1] + change);
  }
  return prices;
};

describe('Technical Indicators', () => {
  const closes = generatePrices(200, 50000);
  const highs = closes.map(c => c * 1.01);
  const lows = closes.map(c => c * 0.99);

  test('RSI should return value between 0-100', () => {
    const rsi = calculateRSI(closes);
    expect(rsi.value).toBeGreaterThanOrEqual(0);
    expect(rsi.value).toBeLessThanOrEqual(100);
    expect(rsi.signal).toBeDefined();
  });

  test('RSI should detect overbought/oversold', () => {
    const risingPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const rsi = calculateRSI(risingPrices);
    expect(rsi.value).toBeGreaterThan(50);
  });

  test('MACD should return valid components', () => {
    const macd = calculateMACD(closes);
    expect(typeof macd.macdLine).toBe('number');
    expect(typeof macd.signalLine).toBe('number');
    expect(typeof macd.histogram).toBe('number');
    expect(['bullish', 'bearish', 'none']).toContain(macd.crossover);
  });

  test('Bollinger Bands should have upper > middle > lower', () => {
    const bb = calculateBollingerBands(closes);
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
    expect(bb.percentB).toBeGreaterThanOrEqual(0);
  });

  test('EMA should calculate correctly', () => {
    const ema = calculateEMA(closes, 9);
    expect(ema.length).toBe(closes.length);
    expect(ema[0]).toBe(closes[0]);
  });

  test('EMA Crossover should detect trends', () => {
    const emaCross = calculateEMACrossover(closes);
    expect(emaCross.ema9).toBeGreaterThan(0);
    expect(emaCross.ema21).toBeGreaterThan(0);
    expect(emaCross.ema50).toBeGreaterThan(0);
    expect(['bullish', 'bearish', 'neutral']).toContain(emaCross.trend);
  });

  test('Stochastic RSI should return K and D between 0-100', () => {
    const stoch = calculateStochasticRSI(closes);
    expect(stoch.k).toBeGreaterThanOrEqual(0);
    expect(stoch.k).toBeLessThanOrEqual(100);
    expect(stoch.d).toBeGreaterThanOrEqual(0);
    expect(stoch.d).toBeLessThanOrEqual(100);
  });

  test('ATR should return positive value', () => {
    const atr = calculateATR(highs, lows, closes);
    expect(atr.value).toBeGreaterThanOrEqual(0);
    expect(atr.percentATR).toBeGreaterThanOrEqual(0);
  });

  test('ADX should return value between 0-100', () => {
    const adx = calculateADX(highs, lows, closes);
    expect(adx.adx).toBeGreaterThanOrEqual(0);
    expect(adx.adx).toBeLessThanOrEqual(100);
    expect(adx.plusDI).toBeGreaterThanOrEqual(0);
    expect(adx.minusDI).toBeGreaterThanOrEqual(0);
  });
});
