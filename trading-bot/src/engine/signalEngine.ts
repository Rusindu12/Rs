import {
  atr,
  averageVolume,
  bollingerBands,
  closes,
  ema,
  fibonacci,
  ichimoku,
  last,
  lows,
  highs,
  macd,
  rsi,
  stochastic,
  volumeProfile,
  volumes,
  vwap,
  type Candle,
} from '../indicators/indicators';
import { adx, detectCandlePattern, detectRsiDivergence } from '../indicators/advanced';
import type {
  IndicatorSnapshot,
  Signal,
  SignalFactor,
  SymbolMarketData,
} from './types';
import type { Timeframe } from '../config';
import { effectiveWeights, type EffectiveWeights } from './training';

/** Higher timeframes carry more weight in the confluence mean (spec base). */
const TF_WEIGHTS: Partial<Record<Timeframe, number>> = {
  '1m': 0.5,
  '5m': 1,
  '15m': 1.5,
  '1h': 2,
  '4h': 2.5,
};

/**
 * Compute every indicator we track for a candle series (primary timeframe).
 */
export function computeIndicators(c: Candle[]): IndicatorSnapshot {
  const cl = closes(c);
  const price = last(cl);
  const r = rsi(cl, 14);
  const m = macd(cl, 12, 26, 9);
  const bb = bollingerBands(cl, 20, 2);
  const e9 = ema(cl, 9);
  const e21 = ema(cl, 21);
  const e50 = ema(cl, 50);
  const e200 = ema(cl, 200);
  const st = stochastic(highs(c), lows(c), cl, 14, 3, 3);
  const a = atr(c, 14);
  const vol = volumes(c);
  const avgVol = averageVolume(vol, 20);
  const vw = vwap(c);
  const ich = ichimoku(c);
  const fib = fibonacci(c, 100);
  const vp = volumeProfile(c, 24);

  const senkouA = last(ich.senkouA);
  const senkouB = last(ich.senkouB);
  const priceAboveCloud =
    isFinite(senkouA) && isFinite(senkouB) ? price > Math.max(senkouA, senkouB) : null;

  const nearestFib = fib.levels.reduce((best, lv) => {
    const d = Math.abs(price - lv.price);
    return d < best.d ? { d, lv } : best;
  }, { d: Infinity, lv: fib.levels[0] });

  const atrVal = last(a);
  return {
    price,
    rsi: last(r),
    macdLine: last(m.macd),
    macdSignal: last(m.signal),
    macdHistogram: last(m.histogram),
    bbUpper: last(bb.upper),
    bbMiddle: last(bb.middle),
    bbLower: last(bb.lower),
    ema9: last(e9),
    ema21: last(e21),
    ema50: last(e50),
    ema200: last(e200),
    stochK: last(st.k),
    stochD: last(st.d),
    atr: atrVal,
    atrPct: isFinite(atrVal) && price ? (atrVal / price) * 100 : NaN,
    volume: last(vol),
    avgVolume: avgVol,
    vwap: last(vw),
    ichimoku: {
      tenkan: last(ich.tenkan),
      kijun: last(ich.kijun),
      senkouA,
      senkouB,
      priceAboveCloud,
    },
    fib: {
      high: fib.high,
      low: fib.low,
      nearest: nearestFib.lv.price,
      distancePct: price ? (Math.abs(price - nearestFib.lv.price) / price) * 100 : NaN,
    },
    volumeProfile: { poc: vp.poc, vah: vp.vah, val: vp.val },
  };
}

/** Multi-timeframe confluence: higher-TF-weighted mean of core scores, capped at ±15. */
export function multiTimeframeConfluence(
  data: SymbolMarketData,
  weightOverrides?: Partial<Record<Timeframe, number>>,
  th?: { rsiOversold: number; rsiOverbought: number }
): { score: number; perTf: { tf: Timeframe; score: number }[] } {
  const perTf: { tf: Timeframe; score: number }[] = [];
  const tfs = Object.keys(data.candles) as Timeframe[];
  let wSum = 0;
  let wScore = 0;
  for (const tf of tfs) {
    const candles = data.candles[tf];
    if (!candles || candles.length < 60) continue;
    const sc = coreScore(candles, th);
    perTf.push({ tf, score: sc });
    const w = (TF_WEIGHTS[tf] ?? 1) * (weightOverrides?.[tf] ?? 1);
    wSum += w;
    wScore += sc * w;
  }
  if (!perTf.length) return { score: 0, perTf };
  const mean = wSum > 0 ? wScore / wSum : 0;
  return { score: Math.max(-15, Math.min(15, mean)), perTf };
}

/**
 * The core scoring rules from the AI trading logic spec, applied to one
 * candle series. Used both for the primary timeframe factors (full weights)
 * and for each timeframe in the multi-timeframe confluence.
 */
function coreScore(c: Candle[], th?: { rsiOversold: number; rsiOverbought: number }): number {
  const os = th?.rsiOversold ?? 30;
  const ob = th?.rsiOverbought ?? 70;
  const cl = closes(c);
  const price = last(cl);
  let score = 0;

  // RSI Analysis (14)
  const r = last(rsi(cl, 14));
  if (isFinite(r)) {
    if (r < os) score += 20;
    else if (r > ob) score -= 20;
  }

  // MACD Analysis (12, 26, 9)
  const m = macd(cl, 12, 26, 9);
  const macdLine = last(m.macd);
  const signalLine = last(m.signal);
  const hist = last(m.histogram);
  if (isFinite(hist)) {
    if (macdLine > signalLine && hist > 0) score += 15;
    else if (macdLine < signalLine && hist < 0) score -= 15;
  }

  // Bollinger Bands (20, 2)
  const bb = bollingerBands(cl, 20, 2);
  const upper = last(bb.upper);
  const lower = last(bb.lower);
  if (isFinite(lower)) {
    if (price <= lower) score += 15;
    else if (price >= upper) score -= 15;
  }

  // EMA Trend (9 / 21 / 50)
  const e9 = last(ema(cl, 9));
  const e21 = last(ema(cl, 21));
  const e50 = last(ema(cl, 50));
  if (isFinite(e50)) {
    if (e9 > e21 && e21 > e50) score += 20;
    else if (e9 < e21 && e21 < e50) score -= 20;
  }

  return score;
}

/**
 * generate_signal — direct TypeScript port of the AI trading logic spec:
 *
 *   score >=  60 -> STRONG_BUY
 *   score >=  30 -> BUY
 *   score <= -60 -> STRONG_SELL
 *   score <= -30 -> SELL
 *   otherwise    -> HOLD
 */
export function generateSignal(
  data: SymbolMarketData,
  weights: EffectiveWeights = effectiveWeights()
): Signal {
  const factors: SignalFactor[] = [];
  const primary = pickPrimary(data);
  const ind = computeIndicators(primary);
  const price = data.lastPrice ?? ind.price;
  let score = 0;
  const scale = (name: string, raw: number) =>
    raw === 0 ? 0 : Math.round(raw * (weights.factorScale[name] ?? 1) * 10) / 10;

  // 1) RSI Analysis (trained thresholds, spec: 30/70)
  if (isFinite(ind.rsi)) {
    if (ind.rsi < weights.thresholds.rsiOversold) {
      const s = scale('RSI', 20);
      score += s;
      factors.push({ name: 'RSI', detail: `RSI ${ind.rsi.toFixed(1)} — oversold`, score: s });
    } else if (ind.rsi > weights.thresholds.rsiOverbought) {
      const s = scale('RSI', -20);
      score += s;
      factors.push({ name: 'RSI', detail: `RSI ${ind.rsi.toFixed(1)} — overbought`, score: s });
    } else {
      factors.push({ name: 'RSI', detail: `RSI ${ind.rsi.toFixed(1)} — neutral`, score: 0 });
    }
  }

  // 2) MACD Analysis (±15)
  if (isFinite(ind.macdHistogram)) {
    if (ind.macdLine > ind.macdSignal && ind.macdHistogram > 0) {
      const s = scale('MACD', 15);
      score += s;
      factors.push({ name: 'MACD', detail: 'bullish crossover', score: s });
    } else if (ind.macdLine < ind.macdSignal && ind.macdHistogram < 0) {
      const s = scale('MACD', -15);
      score += s;
      factors.push({ name: 'MACD', detail: 'bearish crossover', score: s });
    } else {
      factors.push({
        name: 'MACD',
        detail: `hist ${ind.macdHistogram >= 0 ? '+' : ''}${ind.macdHistogram.toFixed(4)} — mixed`,
        score: 0,
      });
    }
  }

  // 3) Bollinger Bands (±15)
  if (isFinite(ind.bbLower)) {
    const bbPos = (price - ind.bbLower) / Math.max(1e-12, ind.bbUpper - ind.bbLower); // 0..1
    if (price <= ind.bbLower) {
      const s = scale('BBands', 15);
      score += s;
      factors.push({ name: 'BBands', detail: 'at/below lower band — support', score: s });
    } else if (price >= ind.bbUpper) {
      const s = scale('BBands', -15);
      score += s;
      factors.push({ name: 'BBands', detail: 'at/above upper band — resistance', score: s });
    } else {
      factors.push({
        name: 'BBands',
        detail: `inside bands (${(bbPos * 100).toFixed(0)}% of range)`,
        score: 0,
      });
    }
  }

  // 4) EMA Trend (±20)
  if (isFinite(ind.ema50)) {
    if (ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50) {
      const s = scale('EMA', 20);
      score += s;
      factors.push({ name: 'EMA', detail: '9 > 21 > 50 — strong uptrend', score: s });
    } else if (ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50) {
      const s = scale('EMA', -20);
      score += s;
      factors.push({ name: 'EMA', detail: '9 < 21 < 50 — strong downtrend', score: s });
    } else {
      factors.push({ name: 'EMA', detail: 'no clean 9/21/50 stack', score: 0 });
    }
  }

  // 5) Volume Confirmation (trained spike threshold, spec: 1.5×)
  if (isFinite(ind.avgVolume) && ind.avgVolume > 0) {
    const ratio = ind.volume / ind.avgVolume;
    if (ratio > weights.thresholds.volumeSpike && score !== 0) {
      const volScore = scale('Volume', score > 0 ? 10 : -10);
      score += volScore;
      factors.push({
        name: 'Volume',
        detail: `${ratio.toFixed(1)}× average — confirms ${volScore > 0 ? 'buy' : 'sell'} pressure`,
        score: volScore,
      });
    } else {
      factors.push({
        name: 'Volume',
        detail: `${ratio.toFixed(1)}× average`,
        score: 0,
      });
    }
  }

  // 6) Stochastic (±10)
  if (isFinite(ind.stochK) && isFinite(ind.stochD)) {
    if (ind.stochK < 20 && ind.stochK > ind.stochD) {
      const s = scale('Stoch', 10);
      score += s;
      factors.push({ name: 'Stoch', detail: `%K ${ind.stochK.toFixed(1)} oversold, crossing up`, score: s });
    } else if (ind.stochK > 80 && ind.stochK < ind.stochD) {
      const s = scale('Stoch', -10);
      score += s;
      factors.push({ name: 'Stoch', detail: `%K ${ind.stochK.toFixed(1)} overbought, crossing down`, score: s });
    } else {
      factors.push({ name: 'Stoch', detail: `%K ${ind.stochK.toFixed(1)} / %D ${ind.stochD.toFixed(1)}`, score: 0 });
    }
  }

  // 7) Multi-timeframe confluence (±15, trained TF weights)
  const mtf = multiTimeframeConfluence(data, weights.mtfWeights, weights.thresholds);
  {
    const s = scale('Multi-TF', mtf.score);
    score += s;
    factors.push({
      name: 'Multi-TF',
      detail: mtf.perTf.map((x) => `${x.tf}:${x.score > 0 ? '+' : ''}${x.score.toFixed(0)}`).join('  '),
      score: s,
    });
  }

  /* ---------------- AI v2: pattern / divergence / S-R / regime ------------ */

  // 8) Candlestick pattern (up to ±12)
  const pattern = detectCandlePattern(primary);
  if (pattern) {
    const s = scale('Pattern', pattern.score);
    score += s;
    factors.push({ name: 'Pattern', detail: pattern.name, score: s });
  }

  // 9) RSI divergence (±10)
  const divergence = detectRsiDivergence(primary);
  if (divergence) {
    const dv = scale('Divergence', divergence === 'bullish' ? 10 : -10);
    score += dv;
    factors.push({
      name: 'Divergence',
      detail: `${divergence} RSI divergence — reversal pressure`,
      score: dv,
    });
  }

  // 10) Support/Resistance confluence: Volume Profile + Fibonacci + VWAP (±10)
  let srScore = 0;
  let srBias = 'no clear S/R interaction';
  const vp = ind.volumeProfile;
  const near = (lvl: number, pct: number) => Math.abs(price - lvl) / Math.max(1e-12, lvl) < pct / 100;
  if (isFinite(vp.poc)) {
    if (near(vp.poc, 0.4) || near(vp.val, 0.4)) {
      srScore += 4;
      srBias = 'at value-area support (POC/VAL)';
    } else if (near(vp.vah, 0.4)) {
      srScore -= 4;
      srBias = 'at value-area resistance (VAH)';
    } else if (price > vp.vah) {
      srScore += 3;
      srBias = 'breakout above value area';
    } else if (price < vp.val) {
      srScore -= 3;
      srBias = 'breakdown below value area';
    }
  }
  if (isFinite(ind.fib.nearest) && ind.fib.distancePct < 0.4) {
    if (ind.fib.nearest < price) {
      srScore += 3;
      srBias += ' · fib support below';
    } else {
      srScore -= 3;
      srBias += ' · fib resistance above';
    }
  }
  if (isFinite(ind.vwap)) {
    if (price > ind.vwap && srScore > 0) srScore += 2;
    else if (price < ind.vwap && srScore < 0) srScore -= 2;
  }
  srScore = Math.max(-10, Math.min(10, srScore));
  if (srScore !== 0) {
    const s = scale('S/R Zones', srScore);
    score += s;
    factors.push({ name: 'S/R Zones', detail: srBias, score: s });
  }

  // 11) ADX trend regime (±5) — trained gate
  const adxRes = adx(primary, 14);
  const adxVal = last(adxRes.adx);
  const emaFactor = factors.find((f) => f.name === 'EMA');
  let regime: 'trending' | 'ranging' = 'ranging';
  if (isFinite(adxVal) && adxVal >= 25) {
    regime = 'trending';
    const gateRaw = weights.regimeGate && emaFactor && emaFactor.score !== 0 ? (emaFactor.score > 0 ? 5 : -5) : 0;
    const gate = scale('Regime', gateRaw);
    if (gate !== 0) {
      score += gate;
      factors.push({
        name: 'Regime',
        detail: `ADX ${adxVal.toFixed(0)} — trending market ${gate > 0 ? 'supports' : 'opposes'} the trend side`,
        score: gate,
      });
    } else {
      factors.push({
        name: 'Regime',
        detail: `ADX ${adxVal.toFixed(0)} — trending, no clean EMA stack`,
        score: 0,
      });
    }
  } else if (isFinite(adxVal)) {
    factors.push({
      name: 'Regime',
      detail: `ADX ${adxVal.toFixed(0)} — ranging market (mean-reversion weights hold)`,
      score: 0,
    });
  }

  const atrPct = isFinite(ind.atrPct) ? ind.atrPct : 0;

  // Informational context (computed in real time, displayed but not scored):
  if (isFinite(ind.vwap)) {
    factors.push({
      name: 'VWAP',
      detail: `price ${price >= ind.vwap ? 'above' : 'below'} VWAP ${ind.vwap.toPrecision(6)}`,
      score: 0,
      informational: true,
    });
  }
  if (ind.ichimoku.priceAboveCloud !== null) {
    factors.push({
      name: 'Ichimoku',
      detail: ind.ichimoku.priceAboveCloud ? 'price above Kumo cloud' : 'price in/below Kumo cloud',
      score: 0,
      informational: true,
    });
  }
  if (isFinite(ind.atrPct)) {
    factors.push({
      name: 'ATR',
      detail: `${ind.atrPct.toFixed(2)}% of price — ${ind.atrPct > 3 ? 'high' : 'normal'} volatility`,
      score: 0,
      informational: true,
    });
  }
  if (isFinite(ind.fib.nearest)) {
    factors.push({
      name: 'Fibonacci',
      detail: `nearest level ${ind.fib.nearest.toPrecision(6)} (${ind.fib.distancePct.toFixed(2)}% away)`,
      score: 0,
      informational: true,
    });
  }
  if (isFinite(ind.volumeProfile.poc)) {
    factors.push({
      name: 'Vol Profile',
      detail: `POC ${ind.volumeProfile.poc.toPrecision(6)}, VA ${ind.volumeProfile.val.toPrecision(6)}–${ind.volumeProfile.vah.toPrecision(6)}`,
      score: 0,
      informational: true,
    });
  }

  const action = scoreToAction(score);

  // Confidence blends the raw score with factor agreement: a big score built
  // from a single factor is trusted less than the same score with every
  // factor pointing the same way.
  const scored = factors.filter((f) => !f.informational && f.score !== 0);
  const totalMag = scored.reduce((s2, f) => s2 + Math.abs(f.score), 0);
  const signedSum = scored.reduce((s2, f) => s2 + f.score, 0);
  const agreement = totalMag > 0 ? Math.abs(signedSum) / totalMag : 0;
  const confidence = Math.max(0, Math.min(100, Math.round(0.8 * Math.abs(score) + 20 * agreement)));

  return {
    symbol: data.symbol,
    action,
    score: Math.round(score * 10) / 10,
    confidence,
    factors,
    timeframes: mtf.perTf,
    price,
    computedAt: Date.now(),
    extras: {
      pattern: pattern?.name,
      divergence,
      regime,
      adx: isFinite(adxVal) ? Math.round(adxVal * 10) / 10 : 0,
      expectedMovePct: Math.round(atrPct * 2 * 10) / 10,
      atrPct: Math.round(atrPct * 100) / 100,
      srBias,
    },
  };
}

export function scoreToAction(score: number): Signal['action'] {
  if (score >= 60) return 'STRONG_BUY';
  if (score >= 30) return 'BUY';
  if (score <= -60) return 'STRONG_SELL';
  if (score <= -30) return 'SELL';
  return 'HOLD';
}

function pickPrimary(data: SymbolMarketData): Candle[] {
  const order: Timeframe[] = ['15m', '5m', '1h', '1m', '4h'];
  for (const tf of order) {
    const c = data.candles[tf];
    if (c && c.length >= 60) return c;
  }
  // Degraded fallback: whatever exists.
  const any = Object.values(data.candles).find((c) => c && c.length);
  return any ?? [];
}
