/**
 * Walk-forward optimizer: seeded random search + coordinate hill-climb.
 * Optimizes on the train segment; the best candidate must also beat the
 * spec-default config on the untouched test segment (anti-overfit guard).
 */
import { BASE_CONFIG, backtestSegment, fitness, type Metrics, type Prepared, type Segment, type TrainableConfig } from './backtest';
import type { Timeframe } from '../src/config';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const FACTOR_KEYS = ['RSI', 'MACD', 'BBands', 'EMA', 'Volume', 'Stoch', 'Multi-TF', 'Pattern', 'Regime'];
const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h'];

function randomConfig(rand: () => number): TrainableConfig {
  const scale: Record<string, number> = {};
  for (const f of FACTOR_KEYS) scale[f] = 0.5 + rand() * 1.0; // 0.5–1.5
  scale.Divergence = 1;
  scale['S/R Zones'] = 1;
  const os = 22 + rand() * 12; // 22–34
  const ob = os + 30 + rand() * 10; // os+30 … os+40 (kept ≥ 62)
  const mtfMult: Partial<Record<Timeframe, number>> = {};
  for (const tf of TFS) mtfMult[tf] = 0.5 + rand() * 1.1; // 0.5–1.6
  return {
    factorScale: scale,
    rsiOversold: Math.round(os * 10) / 10,
    rsiOverbought: Math.round(Math.min(78, ob) * 10) / 10,
    volumeSpike: 1.2 + rand() * 0.8, // 1.2–2.0
    regimeGate: rand() < 0.8,
    mtfMult,
  };
}

function mutate(base: TrainableConfig, rand: () => number, step: number): TrainableConfig {
  const scale: Record<string, number> = { ...base.factorScale };
  const f = FACTOR_KEYS[Math.floor(rand() * FACTOR_KEYS.length)];
  scale[f] = clamp((scale[f] ?? 1) + (rand() * 2 - 1) * step, 0.5, 1.5);
  const mtfMult: Partial<Record<Timeframe, number>> = { ...base.mtfMult };
  if (rand() < 0.4) {
    const tf = TFS[Math.floor(rand() * TFS.length)];
    mtfMult[tf] = clamp((mtfMult[tf] ?? 1) + (rand() * 2 - 1) * step, 0.5, 1.6);
  }
  let os = base.rsiOversold;
  let ob = base.rsiOverbought;
  if (rand() < 0.4) {
    os = clamp(os + (rand() * 2 - 1) * step * 8, 22, 38);
    ob = clamp(ob + (rand() * 2 - 1) * step * 8, 62, 78);
    if (ob - os < 24) ob = Math.min(78, os + 24);
  }
  let vs = base.volumeSpike;
  if (rand() < 0.3) vs = clamp(vs + (rand() * 2 - 1) * step, 1.2, 2.0);
  let regimeGate = base.regimeGate;
  if (rand() < 0.1) regimeGate = !regimeGate;
  return { factorScale: scale, rsiOversold: r1(os), rsiOverbought: r1(ob), volumeSpike: r1(vs), regimeGate, mtfMult };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export interface EvalResult {
  cfg: TrainableConfig;
  train: Metrics;
  test: Metrics;
  trainFit: number;
  testFit: number;
}

function evalOn(prep: Prepared, trainSeg: Segment, testSeg: Segment, cfg: TrainableConfig): EvalResult {
  const train = backtestSegment(prep, trainSeg, cfg);
  const test = backtestSegment(prep, testSeg, cfg);
  return { cfg, train, test, trainFit: fitness(train), testFit: fitness(test) };
}

export interface OptimizeOptions {
  evals: number;
  seed: number;
}

/**
 * Global optimization across symbols: fitness is averaged so one symbol's
 * quirks don't dominate. Returns the chosen config (never worse than the
 * spec defaults on the test segment) plus diagnostics.
 */
export function optimize(
  preps: Prepared[],
  trainSeg: Segment,
  testSeg: Segment,
  opts: OptimizeOptions
): { chosen: TrainableConfig; best: EvalResult; defaultResult: EvalResult; evalsRun: number } {
  const rand = lcg(opts.seed);
  const evalAvg = (cfg: TrainableConfig): EvalResult => {
    // average metrics across symbols
    let trainFit = 0;
    let testFit = 0;
    const trains: Metrics[] = [];
    const tests: Metrics[] = [];
    for (const p of preps) {
      const r = evalOn(p, trainSeg, testSeg, cfg);
      trainFit += r.trainFit;
      testFit += r.testFit;
      trains.push(r.train);
      tests.push(r.test);
    }
    const n = Math.max(1, preps.length);
    return {
      cfg,
      train: avgMetrics(trains, n),
      test: avgMetrics(tests, n),
      trainFit: trainFit / n,
      testFit: testFit / n,
    };
  };

  const defaultResult = evalAvg(BASE_CONFIG);
  let best = defaultResult;

  // phase 1 — random search
  for (let e = 0; e < Math.floor(opts.evals * 0.6); e++) {
    const cand = evalAvg(randomConfig(rand));
    if (cand.trainFit > best.trainFit) best = cand;
  }

  // phase 2 — coordinate hill-climb around the best
  for (let round = 0; round < Math.floor(opts.evals * 0.4); round++) {
    const step = 0.3 * Math.pow(0.85, Math.floor(round / 10));
    const cand = evalAvg(mutate(best.cfg, rand, Math.max(0.05, step)));
    if (cand.trainFit > best.trainFit) best = cand;
  }

  // anti-overfit guard: keep defaults unless the trained config also wins out-of-sample
  const chosen = best.testFit >= defaultResult.testFit ? best.cfg : BASE_CONFIG;
  const finalBest = chosen === BASE_CONFIG ? defaultResult : best;
  return { chosen, best: finalBest, defaultResult, evalsRun: opts.evals };
}

function avgMetrics(list: Metrics[], n: number): Metrics {
  const sum = (get: (m: Metrics) => number) => list.reduce((s, m) => s + get(m), 0) / n;
  const acc = {
    buy: {
      n: Math.round(sum((m) => m.acc.buy.n)),
      correct: Math.round(sum((m) => m.acc.buy.correct)),
    },
    sell: {
      n: Math.round(sum((m) => m.acc.sell.n)),
      correct: Math.round(sum((m) => m.acc.sell.correct)),
    },
    hold: {
      n: Math.round(sum((m) => m.acc.hold.n)),
      correct: Math.round(sum((m) => m.acc.hold.correct)),
    },
  };
  const totalN = acc.buy.n + acc.sell.n + acc.hold.n;
  return {
    bars: Math.round(sum((m) => m.bars)),
    trades: Math.round(sum((m) => m.trades)),
    winRate: sum((m) => m.winRate),
    returnPct: sum((m) => m.returnPct),
    maxDrawdownPct: sum((m) => m.maxDrawdownPct),
    profitFactor: sum((m) => m.profitFactor),
    classAcc:
      totalN > 0
        ? ((acc.buy.correct + acc.sell.correct + acc.hold.correct) / totalN) * 100
        : 0,
    acc,
  };
}
