import { mapScoreToSignal } from '../src/engine/signalEngine';
import { generateSignal } from '../src/engine/signalEngine';
import { BinanceKline } from '../src/types/binance';

describe('Signal Engine', () => {
  test('mapScoreToSignal should map correctly', () => {
    expect(mapScoreToSignal(80)).toBe('STRONG_BUY');
    expect(mapScoreToSignal(50)).toBe('BUY');
    expect(mapScoreToSignal(20)).toBe('WEAK_BUY');
    expect(mapScoreToSignal(0)).toBe('HOLD');
    expect(mapScoreToSignal(-20)).toBe('WEAK_SELL');
    expect(mapScoreToSignal(-50)).toBe('SELL');
    expect(mapScoreToSignal(-80)).toBe('STRONG_SELL');
  });

  test('generateSignal should return valid breakdown', () => {
    const klines: BinanceKline[] = [];
    let price = 50000;
    for (let i = 0; i < 200; i++) {
      const open = price;
      const close = price + (Math.random() - 0.48) * 500;
      const high = Math.max(open, close) * 1.005;
      const low = Math.min(open, close) * 0.995;
      klines.push({
        openTime: Date.now() - (200 - i) * 3600000,
        open: open.toFixed(2), high: high.toFixed(2), low: low.toFixed(2), close: close.toFixed(2),
        volume: (Math.random() * 1000).toFixed(2),
        closeTime: Date.now() - (199 - i) * 3600000,
        quoteAssetVolume: '0', numberOfTrades: 100,
        takerBuyBaseAssetVolume: '0', takerBuyQuoteAssetVolume: '0', ignore: '0',
      });
      price = close;
    }

    const breakdown = generateSignal(klines, '1h');
    expect(breakdown.signalType).toBeDefined();
    expect(breakdown.totalScore).toBeGreaterThanOrEqual(-100);
    expect(breakdown.totalScore).toBeLessThanOrEqual(100);
    expect(breakdown.confidence).toBeGreaterThanOrEqual(0);
    expect(breakdown.confidence).toBeLessThanOrEqual(100);
    expect(breakdown.indicators.length).toBe(10);
    expect(breakdown.marketRegime).toBeDefined();
  });
});
