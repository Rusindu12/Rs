/**
 * Loads the CI-trained weights (training/train.ts → trainedWeights.json) and
 * exposes the effective-weight model used by the signal engine.
 *
 * effective(name) = trainedScale × adaptiveScale (in-app continual learning)
 */
import trained from './trainedWeights.json';
import type { Timeframe } from '../config';

export interface TrainedWeights {
  version: number;
  trainedAt: string;
  dataSource: string;
  symbols: string[];
  barsTested: number;
  evals: number;
  walkForward: { trainBars: number; testBars: number };
  factorScale: Record<string, number>;
  thresholds: { rsiOversold: number; rsiOverbought: number; volumeSpike: number };
  regimeGate: boolean;
  mtfWeights: Partial<Record<Timeframe, number>>;
  performance: {
    trainFit: number;
    testFit: number;
    defaultTestFit: number;
    adopted: boolean;
    winRate: number;
    returnPct: number;
    profitFactor: number;
    maxDrawdownPct: number;
    classAcc: number;
    decisions: {
      buy: { n: number; correct: number; accuracy: number | null };
      sell: { n: number; correct: number; accuracy: number | null };
      hold: { n: number; correct: number; accuracy: number | null };
    };
  };
}

/** The committed (or CI-refreshed) trained model. */
export const TRAINED: TrainedWeights = trained as TrainedWeights;

/** Every factor the engine can emit — all get an effective scale. */
export const FACTOR_KEYS = [
  'RSI', 'MACD', 'BBands', 'EMA', 'Volume', 'Stoch', 'Multi-TF',
  'Pattern', 'Divergence', 'S/R Zones', 'Regime',
];

/** Spec defaults — used when the trained model says it was not adopted. */
export const SPEC_THRESHOLDS = { rsiOversold: 30, rsiOverbought: 70, volumeSpike: 1.5 };

/** Untuned spec configuration — for tests and as the safety baseline. */
export const SPEC_WEIGHTS: EffectiveWeights = {
  factorScale: Object.fromEntries(FACTOR_KEYS.map((k) => [k, 1])),
  thresholds: SPEC_THRESHOLDS,
  regimeGate: true,
  mtfWeights: undefined,
};

export interface EffectiveWeights {
  factorScale: Record<string, number>;
  thresholds: { rsiOversold: number; rsiOverbought: number; volumeSpike: number };
  regimeGate: boolean;
  mtfWeights?: Partial<Record<Timeframe, number>>;
}

const ADAPTIVE_MIN = 0.6;
const ADAPTIVE_MAX = 1.4;

/**
 * Merge trained scales with the in-app adaptive scales (bounded 0.6–1.4).
 * Unknown/invalid entries fall back to 1.
 */
export function effectiveWeights(adaptive?: Record<string, number>): EffectiveWeights {
  const useTrained = TRAINED.performance?.adopted !== false;
  const scale: Record<string, number> = {};
  const src = useTrained ? TRAINED.factorScale : {};
  const keys = new Set([...FACTOR_KEYS, ...Object.keys(src), ...Object.keys(adaptive ?? {})]);
  for (const name of keys) {
    const t = src[name];
    const a = adaptive?.[name];
    let v = 1;
    if (typeof t === 'number' && isFinite(t) && t > 0) v = t;
    if (typeof a === 'number' && isFinite(a) && a > 0) {
      v *= Math.max(ADAPTIVE_MIN, Math.min(ADAPTIVE_MAX, a));
    }
    scale[name] = Math.round(v * 100) / 100;
  }
  return {
    factorScale: scale,
    thresholds: useTrained ? TRAINED.thresholds : SPEC_THRESHOLDS,
    regimeGate: useTrained ? TRAINED.regimeGate : true,
    mtfWeights: useTrained && TRAINED.mtfWeights ? TRAINED.mtfWeights : undefined,
  };
}

export const clampAdaptive = (v: number) => Math.max(ADAPTIVE_MIN, Math.min(ADAPTIVE_MAX, v));
