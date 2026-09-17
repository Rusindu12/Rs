/**
 * AdaptiveLearner — in-app continual learning.
 *
 * Every signal is recorded with the price at emission; after a horizon the
 * realised move is compared with the prediction, and the factors that
 * contributed are nudged (bounded 0.6–1.4×) toward the direction that was
 * right. Fully deterministic, persisted, unit-tested.
 */
import { clampAdaptive } from './training';

export const HORIZON_MS = 2 * 60 * 60 * 1000; // resolve a signal after 2 hours
export const FLAT_BAND = 0.003; // ±0.3 % counts as “no move” (HOLD correct)

export interface PendingSignal {
  symbol: string;
  action: string;
  score: number;
  price: number;
  at: number;
  factors: Record<string, number>; // contributing factor scores (≠ 0 only)
}

export interface AdaptiveState {
  scales: Record<string, number>;
  pending: PendingSignal[];
  evaluated: number;
  correct: number;
  byAction: Record<string, { n: number; correct: number }>;
  adjustments: number;
}

export const EMPTY_STATE: AdaptiveState = {
  scales: {},
  pending: [],
  evaluated: 0,
  correct: 0,
  byAction: {},
  adjustments: 0,
};

export class AdaptiveLearner {
  state: AdaptiveState = { ...EMPTY_STATE, scales: {}, pending: [], byAction: {} };

  constructor(restore?: Partial<AdaptiveState>) {
    // deep-copy the mutable containers so learners never share state
    this.state = restore
      ? {
          ...EMPTY_STATE,
          ...restore,
          scales: { ...(restore.scales ?? {}) },
          pending: [...(restore.pending ?? [])],
          byAction: { ...(restore.byAction ?? {}) },
        }
      : { ...EMPTY_STATE, scales: {}, pending: [], byAction: {} };
  }

  record(signal: {
    symbol: string;
    action: string;
    score: number;
    price: number;
    computedAt: number;
    factors: { name: string; score: number }[];
  }): void {
    if (signal.price <= 0) return;
    const factors: Record<string, number> = {};
    for (const f of signal.factors) {
      if (!f.score) continue;
      factors[f.name] = f.score;
    }
    this.state.pending.push({
      symbol: signal.symbol,
      action: signal.action,
      score: signal.score,
      price: signal.price,
      at: signal.computedAt,
      factors,
    });
    // keep memory bounded
    if (this.state.pending.length > 400) {
      this.state.pending.splice(0, this.state.pending.length - 400);
    }
  }

  /** Resolve matured signals against the latest price; returns #resolved. */
  onPrice(symbol: string, price: number, now = Date.now()): number {
    if (price <= 0) return 0;
    let resolved = 0;
    const keep: PendingSignal[] = [];
    for (const p of this.state.pending) {
      if (p.symbol !== symbol || now - p.at < HORIZON_MS) {
        keep.push(p);
        continue;
      }
      resolved++;
      const ret = (price - p.price) / p.price;
      let outcome: 'up' | 'down' | 'flat';
      if (ret > FLAT_BAND) outcome = 'up';
      else if (ret < -FLAT_BAND) outcome = 'down';
      else outcome = 'flat';

      const isBuy = p.action === 'BUY' || p.action === 'STRONG_BUY';
      const isSell = p.action === 'SELL' || p.action === 'STRONG_SELL';
      const correct = isBuy ? outcome === 'up' : isSell ? outcome === 'down' : outcome === 'flat';

      // stats
      this.state.evaluated++;
      if (correct) this.state.correct++;
      const key = isBuy ? 'BUY' : isSell ? 'SELL' : 'HOLD';
      const b = this.state.byAction[key] ?? { n: 0, correct: 0 };
      b.n++;
      if (correct) b.correct++;
      this.state.byAction[key] = b;

      // weight nudges: contributing factors move toward what worked
      this.state.adjustments++;
      for (const name of Object.keys(p.factors)) {
        const cur = this.state.scales[name] ?? 1;
        const next = clampAdaptive(correct ? cur + 0.02 : cur - 0.02);
        this.state.scales[name] = Math.round(next * 1000) / 1000;
      }
    }
    this.state.pending = keep;
    return resolved;
  }

  stats(): { evaluated: number; correct: number; accuracy: number; byAction: AdaptiveState['byAction'] } {
    const { evaluated, correct, byAction } = this.state;
    return {
      evaluated,
      correct,
      accuracy: evaluated ? (correct / evaluated) * 100 : 0,
      byAction: { ...byAction },
    };
  }
}
