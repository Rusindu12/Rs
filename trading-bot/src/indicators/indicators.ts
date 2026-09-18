/**
 * Real-time technical analysis indicators (pure functions, no RN dependencies).
 *
 * All array-returning functions align their output to the input length, padding
 * the warm-up region with `NaN`, so `out[i]` always corresponds to `candles[i]`.
 */

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

export const closes = (c: Candle[]) => c.map((x) => x.close);
export const highs = (c: Candle[]) => c.map((x) => x.high);
export const lows = (c: Candle[]) => c.map((x) => x.low);
export const volumes = (c: Candle[]) => c.map((x) => x.volume);

export function last(arr: number[]): number {
  return arr.length ? arr[arr.length - 1] : NaN;
}

/** Simple Moving Average. */
export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential Moving Average (seeded with SMA of the first `period` values). */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Relative Strength Index using Wilder's smoothing.
 */
export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/** MACD (default 12, 26, 9). */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    isFinite(emaFast[i]) && isFinite(emaSlow[i]) ? emaFast[i] - emaSlow[i] : NaN
  );
  const firstIdx = macdLine.findIndex((v) => isFinite(v));
  const signal: number[] = new Array(values.length).fill(NaN);
  if (firstIdx >= 0) {
    const compact = macdLine.slice(firstIdx);
    const sig = ema(compact, signalPeriod);
    for (let i = 0; i < sig.length; i++) signal[firstIdx + i] = sig[i];
  }
  const histogram = macdLine.map((v, i) =>
    isFinite(v) && isFinite(signal[i]) ? v - signal[i] : NaN
  );
  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

/** Bollinger Bands (default 20 period, 2 standard deviations). */
export function bollingerBands(values: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: number[] = new Array(values.length).fill(NaN);
  const lower: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let variance = 0;
    const mean = middle[i];
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}

export interface StochResult {
  k: number[];
  d: number[];
}

/** Stochastic Oscillator (default 14, 3, 3 — %K smoothed by 3, %D = SMA(3) of %K). */
export function stochastic(
  candleHighs: number[],
  candleLows: number[],
  closesArr: number[],
  kPeriod = 14,
  kSmooth = 3,
  dPeriod = 3
): StochResult {
  const n = closesArr.length;
  const rawK: number[] = new Array(n).fill(NaN);
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, candleHighs[j]);
      ll = Math.min(ll, candleLows[j]);
    }
    rawK[i] = hh === ll ? 50 : ((closesArr[i] - ll) / (hh - ll)) * 100;
  }
  const firstIdx = rawK.findIndex((v) => isFinite(v));
  const k: number[] = new Array(n).fill(NaN);
  if (firstIdx >= 0) {
    const smoothed = sma(rawK.slice(firstIdx), kSmooth);
    for (let i = 0; i < smoothed.length; i++) k[firstIdx + i] = smoothed[i];
  }
  const kFirst = k.findIndex((v) => isFinite(v));
  const d: number[] = new Array(n).fill(NaN);
  if (kFirst >= 0) {
    const dArr = sma(k.slice(kFirst), dPeriod);
    for (let i = 0; i < dArr.length; i++) d[kFirst + i] = dArr[i];
  }
  return { k, d };
}

/** True Range series. */
export function trueRange(c: Candle[]): number[] {
  const out: number[] = new Array(c.length).fill(NaN);
  for (let i = 1; i < c.length; i++) {
    out[i] = Math.max(
      c[i].high - c[i].low,
      Math.abs(c[i].high - c[i - 1].close),
      Math.abs(c[i].low - c[i - 1].close)
    );
  }
  return out;
}

/** Average True Range using Wilder's smoothing (default 14). */
export function atr(c: Candle[], period = 14): number[] {
  const tr = trueRange(c);
  const out: number[] = new Array(c.length).fill(NaN);
  if (c.length < period + 1) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < c.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Volume Weighted Average Price computed over the provided candle window
 * (a rolling VWAP over the fetched history).
 */
export function vwap(c: Candle[]): number[] {
  const out: number[] = new Array(c.length).fill(NaN);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < c.length; i++) {
    const typical = (c[i].high + c[i].low + c[i].close) / 3;
    cumPV += typical * c[i].volume;
    cumV += c[i].volume;
    out[i] = cumV > 0 ? cumPV / cumV : NaN;
  }
  return out;
}

export interface IchimokuResult {
  tenkan: number[]; // Conversion line (9)
  kijun: number[]; // Base line (26)
  senkouA: number[]; // Leading span A (shifted +26)
  senkouB: number[]; // Leading span B (shifted +26)
  chikou: number[]; // Lagging span (shifted -26)
}

function midpoint(h: number[], l: number[], period: number, i: number): number {
  if (i < period - 1) return NaN;
  let hh = -Infinity;
  let ll = Infinity;
  for (let j = i - period + 1; j <= i; j++) {
    hh = Math.max(hh, h[j]);
    ll = Math.min(ll, l[j]);
  }
  return (hh + ll) / 2;
}

/** Ichimoku Cloud (9, 26, 52; senkou displaced +26, chikou displaced -26). */
export function ichimoku(c: Candle[], conversion = 9, base = 26, spanB = 52, displacement = 26): IchimokuResult {
  const h = highs(c);
  const l = lows(c);
  const n = c.length;
  const tenkan: number[] = new Array(n).fill(NaN);
  const kijun: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    tenkan[i] = midpoint(h, l, conversion, i);
    kijun[i] = midpoint(h, l, base, i);
  }
  const senkouA: number[] = new Array(n).fill(NaN);
  const senkouB: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i >= displacement) {
      const a = tenkan[i - displacement] + kijun[i - displacement];
      senkouA[i] = isFinite(a) ? a / 2 : NaN;
      senkouB[i] = midpoint(h, l, spanB, i - displacement);
    }
  }
  const chikou: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i + displacement < n) chikou[i] = c[i + displacement].close;
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export interface FibLevels {
  high: number;
  low: number;
  levels: { ratio: number; price: number }[];
}

/**
 * Fibonacci retracement levels derived from the highest-high / lowest-low of
 * the window. For an uptrend (close nearer the high) retracements are measured
 * down from the high; for a downtrend, up from the low.
 */
export function fibonacci(c: Candle[], lookback = 100): FibLevels {
  const slice = c.slice(-lookback);
  let hi = -Infinity;
  let lo = Infinity;
  for (const k of slice) {
    hi = Math.max(hi, k.high);
    lo = Math.min(lo, k.low);
  }
  const price = last(closes(slice));
  const uptrend = Math.abs(price - hi) <= Math.abs(price - lo);
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels = ratios.map((ratio) => ({
    ratio,
    price: uptrend ? hi - (hi - lo) * ratio : lo + (hi - lo) * ratio,
  }));
  return { high: hi, low: lo, levels };
}

export interface VolumeProfile {
  bins: { price: number; volume: number }[];
  poc: number; // Point of Control — price bin with the highest traded volume
  vah: number; // Value Area High
  val: number; // Value Area Low
}

/** Volume Profile (horizontal volume histogram + 70% value area). */
export function volumeProfile(c: Candle[], binCount = 24): VolumeProfile {
  const slice = c.slice(-150);
  let hi = -Infinity;
  let lo = Infinity;
  for (const k of slice) {
    hi = Math.max(hi, k.high);
    lo = Math.min(lo, k.low);
  }
  if (!isFinite(hi) || !isFinite(lo) || hi === lo) {
    return { bins: [], poc: NaN, vah: NaN, val: NaN };
  }
  const binSize = (hi - lo) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    price: lo + binSize * (i + 0.5),
    volume: 0,
  }));
  for (const k of slice) {
    const mid = (k.high + k.low + k.close) / 3;
    let idx = Math.floor((mid - lo) / binSize);
    idx = Math.min(binCount - 1, Math.max(0, idx));
    bins[idx].volume += k.volume;
  }
  const sorted = [...bins].sort((a, b) => b.volume - a.volume);
  const poc = sorted[0]?.price ?? NaN;
  // Value area: expand from POC until 70% of volume is captured.
  const total = bins.reduce((s, b) => s + b.volume, 0);
  let captured = sorted[0]?.volume ?? 0;
  let lowIdx = bins.findIndex((b) => b.price === poc);
  let highIdx = lowIdx;
  while (captured < total * 0.7 && (lowIdx > 0 || highIdx < binCount - 1)) {
    const below = lowIdx > 0 ? bins[lowIdx - 1].volume : -1;
    const above = highIdx < binCount - 1 ? bins[highIdx + 1].volume : -1;
    if (above >= below) {
      highIdx += 1;
      captured += bins[highIdx].volume;
    } else {
      lowIdx -= 1;
      captured += bins[lowIdx].volume;
    }
  }
  return { bins, poc, vah: bins[highIdx].price, val: bins[lowIdx].price };
}

/** Average volume over the window (simple mean). */
export function averageVolume(v: number[], window = 20): number {
  const slice = v.slice(-window);
  if (!slice.length) return NaN;
  return slice.reduce((s, x) => s + x, 0) / slice.length;
}
