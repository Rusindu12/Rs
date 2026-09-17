/**
 * Fast backtester + walk-forward evaluation.
 *
 * Indicator series and timeframe alignments are precomputed ONCE per symbol;
 * each candidate config then replays decisions in O(bars). The scorer mirrors
 * src/engine/signalEngine.ts factor-by-factor (parity is unit-tested).
 */
import {
  averageVolume,
  bollingerBands,
  closes,
  ema,
  highs,
  last,
  lows,
  macd,
  rsi,
  stochastic,
  volumes,
  type Candle,
} from '../src/indicators/indicators';
import { adx, detectCandlePattern } from '../src/indicators/advanced';
import { ENGINE_TIMEFRAMES, type Timeframe } from '../src/config';
import type { TrainingSet } from './data';

/* ------------------------------ parameters ------------------------------- */

export interface TrainableConfig {
  factorScale: Record<string, number>;
  rsiOversold: number;
  rsiOverbought: number;
  volumeSpike: number;
  regimeGate: boolean;
  mtfMult: Partial<Record<Timeframe, number>>;
}

export const BASE_CONFIG: TrainableConfig = {
  factorScale: {
    RSI: 1, MACD: 1, BBands: 1, EMA: 1, Volume: 1, Stoch: 1,
    'Multi-TF': 1, Pattern: 1, Divergence: 1, 'S/R Zones': 1, Regime: 1,
  },
  rsiOversold: 30,
  rsiOverbought: 70,
  volumeSpike: 1.5,
  regimeGate: true,
  mtfMult: { '1m': 1, '5m': 1, '15m': 1, '1h': 1, '4h': 1 },
};

export const TF_BASE_WEIGHT: Record<Timeframe, number> = {
  '1m': 0.5,
  '5m': 1,
  '15m': 1.5,
  '1h': 2,
  '4h': 2.5,
};

/* --------------------------- indicator bundles --------------------------- */

interface Bundle {
  close: number[];
  high: number[];
  low: number[];
  vol: number[];
  closeTime: number[];
  rsi: number[];
  macd: number[];
  sig: number[];
  hist: number[];
  bbU: number[];
  bbL: number[];
  e9: number[];
  e21: number[];
  e50: number[];
  avgVol: number[];
  stochK: number[];
  stochD: number[];
  adx: number[];
}

function bundle(c: Candle[]): Bundle {
  const cl = closes(c);
  const vol = volumes(c);
  const m = macd(cl, 12, 26, 9);
  const bb = bollingerBands(cl, 20, 2);
  const st = stochastic(highs(c), lows(c), cl, 14, 3, 3);
  // rolling 20-bar average volume (O(n) window)
  const avgVol: number[] = new Array(cl.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < cl.length; i++) {
    sum += vol[i];
    if (i >= 20) sum -= vol[i - 20];
    if (i >= 19) avgVol[i] = sum / 20;
  }
  return {
    close: cl,
    high: highs(c),
    low: lows(c),
    vol,
    closeTime: c.map((x) => x.closeTime),
    rsi: rsi(cl, 14),
    macd: m.macd,
    sig: m.signal,
    hist: m.histogram,
    bbU: bb.upper,
    bbL: bb.lower,
    e9: ema(cl, 9),
    e21: ema(cl, 21),
    e50: ema(cl, 50),
    avgVol,
    stochK: st.k,
    stochD: st.d,
    adx: adx(c, 14).adx,
  };
}

export interface Prepared {
  set: TrainingSet;
  primary: Bundle;
  /** For each other TF: aligned index per primary bar (last fully-closed bar). */
  align: { tf: Timeframe; b: Bundle; w: number; map: Int32Array }[];
}

export function prepare(set: TrainingSet): Prepared {
  const primary = bundle(set.primary);
  const align: Prepared['align'] = [];
  // the app's confluence INCLUDES the primary timeframe (15m) in the mean
  align.push({
    tf: '15m',
    b: primary,
    w: TF_BASE_WEIGHT['15m'],
    map: Int32Array.from(primary.closeTime, (_, i) => i),
  });
  for (const tf of ENGINE_TIMEFRAMES) {
    if (tf === '15m') continue;
    const cs = set.candles[tf];
    if (!cs || cs.length < 60) continue;
    const b = bundle(cs);
    // two-pointer alignment: for each primary bar i, last tf bar j with
    // closeTime[j] <= closeTime[i]  (O(n) total)
    const map = new Int32Array(primary.closeTime.length);
    let j = 0;
    for (let i = 0; i < primary.closeTime.length; i++) {
      while (j < b.closeTime.length && b.closeTime[j] <= primary.closeTime[i]) j++;
      map[i] = j - 1;
    }
    align.push({ tf, b, w: TF_BASE_WEIGHT[tf], map });
  }
  return { set, primary, align };
}

/* ------------------------------- scoring --------------------------------- */

export type Action = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface ScoreResult {
  score: number;
  factors: Record<string, number>;
  action: Action;
}

function coreScoreAt(b: Bundle, i: number, cfg: TrainableConfig): number {
  let score = 0;
  const r = b.rsi[i];
  if (isFinite(r)) {
    if (r < cfg.rsiOversold) score += 20;
    else if (r > cfg.rsiOverbought) score -= 20;
  }
  const h = b.hist[i];
  if (isFinite(h)) {
    if (b.macd[i] > b.sig[i] && h > 0) score += 15;
    else if (b.macd[i] < b.sig[i] && h < 0) score -= 15;
  }
  const price = b.close[i];
  if (isFinite(b.bbL[i])) {
    if (price <= b.bbL[i]) score += 15;
    else if (price >= b.bbU[i]) score -= 15;
  }
  if (isFinite(b.e50[i])) {
    if (b.e9[i] > b.e21[i] && b.e21[i] > b.e50[i]) score += 20;
    else if (b.e9[i] < b.e21[i] && b.e21[i] < b.e50[i]) score -= 20;
  }
  return score;
}

/**
 * Score bar `i` — mirrors signalEngine.generateSignal for the factors shared
 * with the fast path (RSI, MACD, BBands, EMA, Volume, Stoch, Multi-TF,
 * Pattern, Regime). Order matters: Volume confirms the core-four lean, the
 * regime gate reads the EMA factor — same as the app.
 */
export function scoreBar(prep: Prepared, i: number, cfg: TrainableConfig): ScoreResult {
  const k = (name: string) => cfg.factorScale[name] ?? 1;
  const factors: Record<string, number> = {};
  let score = 0;
  const b = prep.primary;
  const add = (name: string, raw: number) => {
    const s = raw === 0 ? 0 : Math.round(raw * k(name) * 10) / 10;
    factors[name] = s;
    score += s;
  };

  const r = b.rsi[i];
  if (isFinite(r)) {
    if (r < cfg.rsiOversold) add('RSI', 20);
    else if (r > cfg.rsiOverbought) add('RSI', -20);
    else add('RSI', 0);
  } else add('RSI', 0);

  const h = b.hist[i];
  if (isFinite(h)) {
    if (b.macd[i] > b.sig[i] && h > 0) add('MACD', 15);
    else if (b.macd[i] < b.sig[i] && h < 0) add('MACD', -15);
    else add('MACD', 0);
  } else add('MACD', 0);

  const price = b.close[i];
  if (isFinite(b.bbL[i])) {
    if (price <= b.bbL[i]) add('BBands', 15);
    else if (price >= b.bbU[i]) add('BBands', -15);
    else add('BBands', 0);
  } else add('BBands', 0);

  if (isFinite(b.e50[i])) {
    if (b.e9[i] > b.e21[i] && b.e21[i] > b.e50[i]) add('EMA', 20);
    else if (b.e9[i] < b.e21[i] && b.e21[i] < b.e50[i]) add('EMA', -20);
    else add('EMA', 0);
  } else add('EMA', 0);

  const partial = score;
  const av = b.avgVol[i];
  if (isFinite(av) && av > 0) {
    const ratio = b.vol[i] / av;
    if (ratio > cfg.volumeSpike && partial !== 0) add('Volume', partial > 0 ? 10 : -10);
    else add('Volume', 0);
  } else add('Volume', 0);

  const sk = b.stochK[i];
  const sd = b.stochD[i];
  if (isFinite(sk) && isFinite(sd)) {
    if (sk < 20 && sk > sd) add('Stoch', 10);
    else if (sk > 80 && sk < sd) add('Stoch', -10);
    else add('Stoch', 0);
  } else add('Stoch', 0);

  let wSum = 0;
  let wScore = 0;
  for (const o of prep.align) {
    const j = o.map[i];
    if (j < 60) continue;
    const cs = coreScoreAt(o.b, j, cfg);
    const w = o.w * (cfg.mtfMult[o.tf] ?? 1);
    wSum += w;
    wScore += cs * w;
  }
  const mtf = wSum > 0 ? Math.max(-15, Math.min(15, wScore / wSum)) : 0;
  add('Multi-TF', mtf);

  const pat = i >= 2 ? detectCandlePattern(prep.set.primary.slice(i - 2, i + 1)) : null;
  add('Pattern', pat ? pat.score : 0);

  const adxVal = b.adx[i];
  if (isFinite(adxVal) && adxVal >= 25 && cfg.regimeGate) {
    const emaF = factors.EMA ?? 0;
    add('Regime', emaF !== 0 ? (emaF > 0 ? 5 : -5) : 0);
  } else {
    add('Regime', 0);
  }

  const action: Action =
    score >= 60 ? 'STRONG_BUY' : score >= 30 ? 'BUY' : score <= -60 ? 'STRONG_SELL' : score <= -30 ? 'SELL' : 'HOLD';
  return { score: Math.round(score * 10) / 10, factors, action };
}

/* ------------------------------ simulation ------------------------------- */

export interface BacktestParams {
  stopLossPct: number;
  takeProfitPct: number;
  feePct: number;
  horizonBars: number;
  warmup: number;
}

export const DEFAULT_BT: BacktestParams = {
  stopLossPct: 2,
  takeProfitPct: 4,
  feePct: 0.1,
  horizonBars: 8,
  warmup: 250,
};

export interface Metrics {
  bars: number;
  trades: number;
  winRate: number;
  returnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  classAcc: number;
  acc: {
    buy: { n: number; correct: number };
    sell: { n: number; correct: number };
    hold: { n: number; correct: number };
  };
}

export interface Segment {
  from: number;
  to: number; // exclusive
}

/** Replay one segment. Decisions at bar i use only bars ≤ i (no lookahead). */
export function backtestSegment(
  prep: Prepared,
  seg: Segment,
  cfg: TrainableConfig,
  bt: BacktestParams = DEFAULT_BT
): Metrics {
  const b = prep.primary;
  const n = Math.min(seg.to, b.close.length);
  const start = Math.max(seg.from, bt.warmup);
  const fee = bt.feePct / 100;

  let balance = 100;
  let entryPrice = 0;
  let entryBar = -1;
  let sl = 0;
  let tp = 0;
  let inPos = false;

  const tradePnls: number[] = [];
  const acc = {
    buy: { n: 0, correct: 0 },
    sell: { n: 0, correct: 0 },
    hold: { n: 0, correct: 0 },
  };

  const closeTrade = (exitPrice: number) => {
    const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100 - 2 * bt.feePct;
    balance *= 1 + pnlPct / 100;
    tradePnls.push(pnlPct);
    inPos = false;
  };

  for (let i = start; i < n; i++) {
    // 1) manage the open position on this bar's range (SL before TP = conservative)
    if (inPos) {
      if (b.low[i] <= sl) closeTrade(sl);
      else if (b.high[i] >= tp) closeTrade(tp);
      else if (i - entryBar >= bt.horizonBars * 4) closeTrade(b.close[i]); // max hold
    }

    // 2) classification outcomes (lookahead only for SCORING history, never for trades)
    const hIdx = i + bt.horizonBars;
    if (hIdx < n) {
      const ret = (b.close[hIdx] - b.close[i]) / b.close[i];
      const r = scoreBar(prep, i, cfg);
      if (r.action === 'BUY' || r.action === 'STRONG_BUY') {
        acc.buy.n++;
        if (ret > 0) acc.buy.correct++;
      } else if (r.action === 'SELL' || r.action === 'STRONG_SELL') {
        acc.sell.n++;
        if (ret < 0) acc.sell.correct++;
      } else {
        acc.hold.n++;
        if (Math.abs(ret) < 0.004) acc.hold.correct++;
      }
    }

    // 3) entries at the NEXT bar's open (realistic fill), long-only
    if (!inPos && i < n - 1) {
      const r = scoreBar(prep, i, cfg);
      if (r.action === 'BUY' || r.action === 'STRONG_BUY') {
        entryPrice = b.close[i + 1];
        entryBar = i + 1;
        sl = entryPrice * (1 - bt.stopLossPct / 100);
        tp = entryPrice * (1 + bt.takeProfitPct / 100);
        inPos = true;
      }
    }
  }

  const wins = tradePnls.filter((x) => x > 0);
  const losses = tradePnls.filter((x) => x <= 0);
  const grossW = wins.reduce((s, x) => s + x, 0);
  const grossL = Math.abs(losses.reduce((s, x) => s + x, 0));

  // equity curve for drawdown (reconstruct from trade boundaries)
  let peak = 100;
  let maxDD = 0;
  let eq = 100;
  for (const pnl of tradePnls) {
    eq *= 1 + pnl / 100;
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, ((peak - eq) / peak) * 100);
  }

  const totalN = acc.buy.n + acc.sell.n + acc.hold.n;
  const classAcc =
    totalN > 0 ? ((acc.buy.correct + acc.sell.correct + acc.hold.correct) / totalN) * 100 : 0;

  return {
    bars: Math.max(0, n - start),
    trades: tradePnls.length,
    winRate: tradePnls.length ? (wins.length / tradePnls.length) * 100 : 0,
    returnPct: balance - 100,
    maxDrawdownPct: maxDD,
    profitFactor: grossL > 0 ? grossW / grossL : grossW > 0 ? 3 : 0,
    classAcc,
    acc,
  };
}

/** Fitness used by the optimizer (higher is better, roughly 0–1). */
export function fitness(m: Metrics): number {
  const pf = Math.min(m.profitFactor, 3) / 3;
  const ret = Math.max(-30, Math.min(60, m.returnPct)) / 60;
  const ddPenalty = Math.max(0, m.maxDrawdownPct - 20) * 0.01;
  return 0.5 * (m.classAcc / 100) + 0.3 * (m.winRate / 100) + 0.1 * pf + 0.1 * ret - ddPenalty;
}

export { last };
