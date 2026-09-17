import { generateSignal } from '../src/engine/signalEngine';
import { effectiveWeights, TRAINED, SPEC_THRESHOLDS } from '../src/engine/training';
import { AdaptiveLearner, EMPTY_STATE, HORIZON_MS, FLAT_BAND } from '../src/engine/adaptive';
import { prepare, scoreBar, backtestSegment, BASE_CONFIG, DEFAULT_BT, fitness } from '../training/backtest';
import { optimize } from '../training/optimize';
import { syntheticKlines } from '../training/data';
import type { SymbolMarketData } from '../src/engine/types';
import type { Candle } from '../src/indicators/indicators';
import type { Timeframe as TF } from '../src/config';

const SHARED_FACTORS = ['RSI', 'MACD', 'BBands', 'EMA', 'Volume', 'Stoch', 'Multi-TF', 'Pattern', 'Regime'];

function mkSet(symbol = 'TESTUSDT', bars = 400) {
  const primary = syntheticKlines(symbol, '15m', bars);
  const end = primary.at(-1)!.closeTime;
  const candles: Partial<Record<TF, Candle[]>> = { '15m': primary };
  for (const tf of ['1h', '4h'] as TF[]) {
    // live feeds end all timeframes at "now"; mirror that so alignment matches
    candles[tf] = syntheticKlines(symbol, tf, bars).filter((c) => c.closeTime <= end);
  }
  return { symbol, primary, candles, live: false };
}

const asMarketData = (set: ReturnType<typeof mkSet>): SymbolMarketData => ({
  symbol: set.symbol,
  candles: set.candles as SymbolMarketData['candles'],
  lastPrice: set.primary.at(-1)?.close,
});

describe('trained weights model', () => {
  it('ships a valid trainedWeights.json with bounded values', () => {
    expect(TRAINED.version).toBeGreaterThanOrEqual(1);
    expect(TRAINED.trainedAt).toBeTruthy();
    expect(TRAINED.thresholds.rsiOversold).toBeGreaterThanOrEqual(20);
    expect(TRAINED.thresholds.rsiOverbought).toBeLessThanOrEqual(80);
    expect(TRAINED.thresholds.rsiOverbought).toBeGreaterThan(TRAINED.thresholds.rsiOversold);
    for (const v of Object.values(TRAINED.factorScale)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(2);
    }
    expect(typeof TRAINED.performance.classAcc).toBe('number');
  });

  it('effectiveWeights merges trained × adaptive and clamps', () => {
    const w = effectiveWeights({ RSI: 10, MACD: 0.1, Pattern: 1.2 });
    const rsiScale = w.factorScale.RSI;
    expect(rsiScale).toBeLessThanOrEqual((TRAINED.factorScale.RSI ?? 1) * 1.4 + 0.001); // adaptive clamped to 1.4
    expect(w.factorScale.MACD).toBeGreaterThanOrEqual((TRAINED.factorScale.MACD ?? 1) * 0.6 - 0.01);
    expect(w.factorScale.Pattern).toBeCloseTo((TRAINED.factorScale.Pattern ?? 1) * 1.2, 1);
    // untouched factor present
    expect(typeof w.factorScale.EMA).toBe('number');
  });

  it('falls back to spec thresholds when the trained model was not adopted', () => {
    const saved = TRAINED.performance.adopted;
    try {
      (TRAINED.performance as { adopted: boolean }).adopted = false;
      const w = effectiveWeights();
      expect(w.thresholds).toEqual(SPEC_THRESHOLDS);
    } finally {
      (TRAINED.performance as { adopted: boolean }).adopted = saved;
    }
  });
});

describe('backtester parity with the app engine', () => {
  it('fast scorer matches generateSignal factor-by-factor', () => {
    const set = mkSet('PARUSDT', 400);
    const prep = prepare(set);
    const i = set.primary.length - 1;
    const weights = effectiveWeights();

    const fast = scoreBar(prep, i, {
      factorScale: weights.factorScale,
      rsiOversold: weights.thresholds.rsiOversold,
      rsiOverbought: weights.thresholds.rsiOverbought,
      volumeSpike: weights.thresholds.volumeSpike,
      regimeGate: weights.regimeGate,
      mtfMult: weights.mtfWeights ?? { '1m': 1, '5m': 1, '15m': 1, '1h': 1, '4h': 1 },
    });

    const app = generateSignal(asMarketData(set), weights);
    for (const name of SHARED_FACTORS) {
      const appF = app.factors.find((f) => f.name === name)?.score ?? 0;
      expect(Math.abs((fast.factors[name] ?? 0) - appF)).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('backtester correctness', () => {
  it('never peeks into the future (truncated run = full run decisions)', () => {
    const set = mkSet('NOLOOK', 400);
    const prep = prepare(set);
    const cut = 380;
    // decisions from the truncated series must equal the full series up to `cut`
    for (let i = 360; i < cut; i += 4) {
      const full = scoreBar(prep, i, BASE_CONFIG);
      const truncatedSet = { ...set, primary: set.primary.slice(0, i + 1) };
      const truncPrep = prepare(truncatedSet);
      const trunc = scoreBar(truncPrep, i, BASE_CONFIG);
      expect(trunc.action).toBe(full.action);
      expect(Math.abs(trunc.score - full.score)).toBeLessThan(0.01);
    }
  });

  it('produces sane metrics on synthetic data', () => {
    const set = mkSet('BT', 500);
    const prep = prepare(set);
    const m = backtestSegment(prep, { from: 0, to: 500 }, BASE_CONFIG, {
      ...DEFAULT_BT,
      warmup: 250,
    });
    expect(m.bars).toBeGreaterThan(100);
    expect(m.trades).toBeGreaterThanOrEqual(0);
    expect(m.winRate).toBeGreaterThanOrEqual(0);
    expect(m.winRate).toBeLessThanOrEqual(100);
    expect(m.classAcc).toBeGreaterThanOrEqual(0);
    expect(m.classAcc).toBeLessThanOrEqual(100);
    expect(fitness(m)).toBeGreaterThan(-1);
  });
});

describe('walk-forward optimizer', () => {
  it('returns bounded weights and respects the out-of-sample guard', () => {
    const preps = [prepare(mkSet('OPT1', 500)), prepare(mkSet('OPT2', 500))];
    const n = Math.min(...preps.map((p) => p.primary.close.length));
    const { chosen, defaultResult, best } = optimize(
      preps,
      { from: 0, to: Math.floor(n * 0.7) },
      { from: Math.floor(n * 0.7), to: n },
      { evals: 30, seed: 7 }
    );
    for (const v of Object.values(chosen.factorScale)) {
      expect(v).toBeGreaterThan(0.4);
      expect(v).toBeLessThan(1.6);
    }
    expect(chosen.rsiOverbought - chosen.rsiOversold).toBeGreaterThanOrEqual(24);
    // guard: chosen is either the defaults or something that beat them OOS
    if (chosen !== BASE_CONFIG) {
      expect(best.testFit).toBeGreaterThanOrEqual(defaultResult.testFit);
    }
  }, 60_000);
});

describe('AdaptiveLearner (in-app continual learning)', () => {
  const sig = (over: Partial<Parameters<AdaptiveLearner['record']>[0]>) => ({
    symbol: 'BTCUSDT',
    action: 'BUY',
    score: 45,
    price: 100,
    computedAt: 1_000_000,
    factors: [
      { name: 'RSI', score: 20 },
      { name: 'MACD', score: 15 },
      { name: 'Stoch', score: 0 },
    ],
    ...over,
  });

  it('nudges contributing factors up after a correct call', () => {
    const l = new AdaptiveLearner(EMPTY_STATE);
    l.record(sig({}));
    const resolved = l.onPrice('BTCUSDT', 102, 1_000_000 + HORIZON_MS + 1); // +2 % = BUY correct
    expect(resolved).toBe(1);
    expect(l.state.scales.RSI).toBeGreaterThan(1);
    expect(l.state.scales.MACD).toBeGreaterThan(1);
    expect(l.state.scales.Stoch).toBeUndefined(); // zero-score factor untouched
    expect(l.stats().evaluated).toBe(1);
    expect(l.stats().correct).toBe(1);
    expect(l.stats().byAction.BUY).toEqual({ n: 1, correct: 1 });
  });

  it('nudges down after a wrong call and clamps to bounds', () => {
    const l = new AdaptiveLearner(EMPTY_STATE);
    l.record(sig({}));
    l.onPrice('BTCUSDT', 97, 1_000_000 + HORIZON_MS + 1); // −3 % = BUY wrong
    expect(l.state.scales.RSI).toBeLessThan(1);
    expect(l.state.scales.MACD).toBeLessThan(1);

    // hammer it with many wrong calls — must clamp at 0.6, never below
    for (let i = 0; i < 100; i++) {
      l.record(sig({ computedAt: 1_000_000 + i * 10 }));
      l.onPrice('BTCUSDT', 50, 1_000_000 + i * 10 + HORIZON_MS + 1);
    }
    expect(l.state.scales.RSI).toBeGreaterThanOrEqual(0.6);
    expect(l.state.scales.RSI).toBeLessThanOrEqual(1.4);
  });

  it('holds signals are graded on staying flat', () => {
    const l = new AdaptiveLearner(EMPTY_STATE);
    l.record(sig({ action: 'HOLD', factors: [{ name: 'RSI', score: 0 }, { name: 'EMA', score: 0 }] }));
    // contributing factors empty for HOLD with all-zero scores → no scale changes
    l.onPrice('BTCUSDT', 100.05, 1_000_000 + HORIZON_MS + 1); // +0.05 % within flat band
    expect(l.stats().evaluated).toBe(1);
    expect(l.stats().correct).toBe(1);

    const l2 = new AdaptiveLearner(EMPTY_STATE);
    l2.record(sig({ action: 'HOLD', score: 35, factors: [{ name: 'RSI', score: 20 }] }));
    l2.onPrice('BTCUSDT', 104, 1_000_000 + HORIZON_MS + 1); // +4 % — HOLD was wrong
    expect(l2.stats().correct).toBe(0);
    expect(l2.state.scales.RSI).toBeLessThan(1);
  });

  it('ignores immature signals and unknown symbols', () => {
    const l = new AdaptiveLearner(EMPTY_STATE);
    l.record(sig({}));
    expect(l.onPrice('BTCUSDT', 110, 1_000_000)).toBe(0); // too early
    expect(l.onPrice('ETHUSDT', 110, 1_000_000 + HORIZON_MS + 1)).toBe(0); // other symbol
    expect(l.state.pending).toHaveLength(1);
  });
});
