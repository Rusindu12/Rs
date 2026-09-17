import { generateSignal, scoreToAction, multiTimeframeConfluence } from '../src/engine/signalEngine';
import { SPEC_WEIGHTS } from '../src/engine/training';
import type { Candle } from '../src/indicators/indicators';
import type { SymbolMarketData } from '../src/engine/types';

/** Deterministic PRNG so fixtures are reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function makeCandles(opts: {
  driftPctPerCandle: number;
  count: number;
  seed?: number;
  noisePct?: number;
  basePrice?: number;
  finalVolumeSpike?: boolean;
}): Candle[] {
  const rand = rng(opts.seed ?? 42);
  const noise = opts.noisePct ?? 0.15;
  let price = opts.basePrice ?? 100;
  const out: Candle[] = [];
  for (let i = 0; i < opts.count; i++) {
    const isLast = i === opts.count - 1;
    const drift = (price * opts.driftPctPerCandle) / 100;
    const nz = price * (noise / 100) * (rand() * 2 - 1);
    const open = price;
    price = Math.max(0.01, price + drift + nz);
    const high = Math.max(open, price) * (1 + (noise / 200) * rand());
    const low = Math.min(open, price) * (1 - (noise / 200) * rand());
    const baseVol = 1000 * (0.5 + rand());
    out.push({
      openTime: i * 60_000,
      open,
      high,
      low,
      close: price,
      volume: isLast && opts.finalVolumeSpike ? baseVol * 2.2 : baseVol,
      closeTime: (i + 1) * 60_000,
      quoteVolume: price * baseVol,
      trades: 100,
    });
  }
  return out;
}

const data = (symbol: string, candlesByTf: Record<string, Candle[]>): SymbolMarketData => ({
  symbol,
  candles: candlesByTf as SymbolMarketData['candles'],
  lastPrice: Object.values(candlesByTf)[0]?.at(-1)?.close,
});

describe('scoreToAction — spec thresholds', () => {
  it('maps scores exactly as the spec requires', () => {
    expect(scoreToAction(60)).toBe('STRONG_BUY');
    expect(scoreToAction(100)).toBe('STRONG_BUY');
    expect(scoreToAction(30)).toBe('BUY');
    expect(scoreToAction(59)).toBe('BUY');
    expect(scoreToAction(29)).toBe('HOLD');
    expect(scoreToAction(0)).toBe('HOLD');
    expect(scoreToAction(-29)).toBe('HOLD');
    expect(scoreToAction(-30)).toBe('SELL');
    expect(scoreToAction(-59)).toBe('SELL');
    expect(scoreToAction(-60)).toBe('STRONG_SELL');
  });
});

describe('generateSignal', () => {
  it('fires BUY on a clean steady uptrend with a volume spike', () => {
    // Trend up, RSI in neutral territory, bullish MACD, stacked EMAs, volume confirm.
    const c = makeCandles({ driftPctPerCandle: 0.15, count: 250, seed: 8, noisePct: 0.7, finalVolumeSpike: true });
    const sig = generateSignal(data('TESTUSDT', { '15m': c, '5m': c.slice(0, 230), '1h': c.slice(0, 210) }), SPEC_WEIGHTS);
    expect(sig.score).toBeGreaterThanOrEqual(30);
    expect(sig.action === 'BUY' || sig.action === 'STRONG_BUY').toBe(true);
    const ema = sig.factors.find((f) => f.name === 'EMA');
    const macd = sig.factors.find((f) => f.name === 'MACD');
    const rsi = sig.factors.find((f) => f.name === 'RSI');
    expect(ema?.score).toBe(20);
    expect(macd?.score).toBe(15);
    expect(rsi?.score).toBe(0);
  });

  it('fires SELL on a clean steady downtrend', () => {
    const c = makeCandles({ driftPctPerCandle: -0.15, count: 250, seed: 2, noisePct: 0.7, finalVolumeSpike: true });
    const sig = generateSignal(data('TESTUSDT', { '15m': c, '5m': c.slice(0, 230), '1h': c.slice(0, 210) }), SPEC_WEIGHTS);
    expect(sig.score).toBeLessThanOrEqual(-30);
    expect(sig.action === 'SELL' || sig.action === 'STRONG_SELL').toBe(true);
    const ema = sig.factors.find((f) => f.name === 'EMA');
    const macd = sig.factors.find((f) => f.name === 'MACD');
    expect(ema?.score).toBe(-20);
    expect(macd?.score).toBe(-15);
  });

  it('holds on flat noise', () => {
    const c = makeCandles({ driftPctPerCandle: 0, count: 250, seed: 5, noisePct: 0.5 });
    const sig = generateSignal(data('TESTUSDT', { '15m': c }), SPEC_WEIGHTS);
    expect(Math.abs(sig.score)).toBeLessThan(30);
    expect(sig.action).toBe('HOLD');
  });

  it('includes the seven scored factors plus informational context', () => {
    const c = makeCandles({ driftPctPerCandle: 0.15, count: 250, seed: 8, noisePct: 0.7 });
    const sig = generateSignal(data('TESTUSDT', { '15m': c }), SPEC_WEIGHTS);
    const names = sig.factors.map((f) => f.name);
    for (const n of ['RSI', 'MACD', 'BBands', 'EMA', 'Volume', 'Stoch', 'Multi-TF']) {
      expect(names).toContain(n);
    }
    // AI v2 factors are always present (Regime), others when they fire.
    expect(names).toContain('Regime');
    for (const n of ['VWAP', 'Ichimoku', 'ATR', 'Fibonacci', 'Vol Profile']) {
      expect(names).toContain(n);
    }
    // AI v2 confidence: 0.8×|score| + 20×factor-agreement, clamped to 100.
    const scored = sig.factors.filter((f) => !f.informational && f.score !== 0);
    const totalMag = scored.reduce((s2, f) => s2 + Math.abs(f.score), 0);
    const agreement = totalMag > 0 ? Math.abs(scored.reduce((s2, f) => s2 + f.score, 0)) / totalMag : 0;
    expect(sig.confidence).toBe(
      Math.max(0, Math.min(100, Math.round(0.8 * Math.abs(sig.score) + 20 * agreement)))
    );
    expect(['trending', 'ranging']).toContain(sig.extras.regime);
    expect(sig.extras.expectedMovePct).toBeGreaterThanOrEqual(0);
  });

  it('multi-timeframe confluence is the capped mean of per-TF scores', () => {
    const up = makeCandles({ driftPctPerCandle: 0.15, count: 250, seed: 8, noisePct: 0.7 });
    const down = makeCandles({ driftPctPerCandle: -0.15, count: 250, seed: 2, noisePct: 0.7 });
    const d = data('TESTUSDT', { '5m': up, '15m': up, '1h': down, '4h': down });
    const mtf = multiTimeframeConfluence(d);
    expect(mtf.perTf).toHaveLength(4);
    // Mixed signals should roughly cancel out → small capped confluence.
    expect(Math.abs(mtf.score)).toBeLessThanOrEqual(15);
  });

  it('falls back to HOLD gracefully with too little data', () => {
    const tiny = makeCandles({ driftPctPerCandle: 1, count: 10, seed: 1 });
    const sig = generateSignal(data('TESTUSDT', { '15m': tiny }));
    expect(sig.action).toBe('HOLD');
    expect(Number.isFinite(sig.score)).toBe(true);
  });
});
