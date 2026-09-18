/**
 * Advanced AI indicators: ADX (trend strength regime), candlestick pattern
 * recognition and RSI divergence detection. Pure functions, no RN deps.
 */
import { last, lows, highs, closes, type Candle } from './indicators';
import { rsi } from './indicators';

export interface AdxResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
}

/**
 * Average Directional Index (Wilder, default 14).
 * ADX ≥ 25 → trending market; < 20 → ranging.
 */
export function adx(c: Candle[], period = 14): AdxResult {
  const n = c.length;
  const out: number[] = new Array(n).fill(NaN);
  const plusDI: number[] = new Array(n).fill(NaN);
  const minusDI: number[] = new Array(n).fill(NaN);
  if (n < period * 2 + 1) return { adx: out, plusDI, minusDI };

  const tr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const upMove = c[i].high - c[i - 1].high;
    const downMove = c[i - 1].low - c[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(
      c[i].high - c[i].low,
      Math.abs(c[i].high - c[i - 1].close),
      Math.abs(c[i].low - c[i - 1].close)
    );
  }

  let str = 0;
  let sPlus = 0;
  let sMinus = 0;
  for (let i = 1; i <= period; i++) {
    str += tr[i];
    sPlus += plusDM[i];
    sMinus += minusDM[i];
  }
  const dx: number[] = new Array(n).fill(NaN);
  const di = (dm: number) => (str > 0 ? (100 * dm) / str : 0);
  plusDI[period] = di(sPlus);
  minusDI[period] = di(sMinus);
  dx[period] = diValue(plusDI[period], minusDI[period]);

  for (let i = period + 1; i < n; i++) {
    str = str - str / period + tr[i];
    sPlus = sPlus - sPlus / period + plusDM[i];
    sMinus = sMinus - sMinus / period + minusDM[i];
    plusDI[i] = di(sPlus);
    minusDI[i] = di(sMinus);
    dx[i] = diValue(plusDI[i], minusDI[i]);
  }

  // Wilder-smooth the DX into ADX.
  let sum = 0;
  for (let i = period; i < period * 2; i++) sum += dx[i];
  let prev = sum / period;
  out[period * 2 - 1] = prev;
  for (let i = period * 2; i < n; i++) {
    prev = (prev * (period - 1) + dx[i]) / period;
    out[i] = prev;
  }
  return { adx: out, plusDI, minusDI };
}

function diValue(plus: number, minus: number): number {
  const total = plus + minus;
  return total > 0 ? (100 * Math.abs(plus - minus)) / total : 0;
}

export interface CandlePattern {
  /** Human-readable pattern name. */
  name: string;
  /** Bullish > 0, bearish < 0. */
  score: number;
}

/**
 * Detect classic reversal candlestick patterns on the last 1–3 candles:
 * engulfing, hammer / shooting star, morning / evening star, doji (info).
 */
export function detectCandlePattern(c: Candle[]): CandlePattern | null {
  if (c.length < 3) return null;
  const a = c[c.length - 3]; // two candles ago
  const b = c[c.length - 2]; // previous
  const d = c[c.length - 1]; // latest

  const body = (x: Candle) => Math.abs(x.close - x.open);
  const range = (x: Candle) => Math.max(1e-12, x.high - x.low);
  const upperWick = (x: Candle) => x.high - Math.max(x.open, x.close);
  const lowerWick = (x: Candle) => Math.min(x.open, x.close) - x.low;
  const bullish = (x: Candle) => x.close > x.open;
  const bearish = (x: Candle) => x.close < x.open;

  // Morning / evening star (3-candle, strongest signal).
  if (bearish(a) && body(a) / range(a) > 0.5 && body(b) / range(b) < 0.3) {
    if (bullish(d) && d.close > (a.open + a.close) / 2) {
      return { name: 'Morning star', score: 12 };
    }
  }
  if (bullish(a) && body(a) / range(a) > 0.5 && body(b) / range(b) < 0.3) {
    if (bearish(d) && d.close < (a.open + a.close) / 2) {
      return { name: 'Evening star', score: -12 };
    }
  }

  // Engulfing (2-candle).
  if (bearish(b) && bullish(d) && d.close >= b.open && d.open <= b.close && body(d) > body(b)) {
    return { name: 'Bullish engulfing', score: 10 };
  }
  if (bullish(b) && bearish(d) && d.close <= b.open && d.open >= b.close && body(d) > body(b)) {
    return { name: 'Bearish engulfing', score: -10 };
  }

  // Hammer / shooting star (1-candle).
  if (body(d) > 0 && lowerWick(d) >= 2 * body(d) && upperWick(d) <= body(d) * 0.6) {
    return { name: 'Hammer', score: 8 };
  }
  if (body(d) > 0 && upperWick(d) >= 2 * body(d) && lowerWick(d) <= body(d) * 0.6) {
    return { name: 'Shooting star', score: -8 };
  }

  // Doji — indecision, informational.
  if (body(d) / range(d) < 0.1) {
    return { name: 'Doji (indecision)', score: 0 };
  }
  return null;
}

export type Divergence = 'bullish' | 'bearish' | null;

/**
 * RSI divergence on the last ~60 bars: compare the last two swing lows /
 * highs of price against RSI.
 *   price lower low + RSI higher low  → bullish (reversal up)
 *   price higher high + RSI lower high → bearish (reversal down)
 */
export function detectRsiDivergence(c: Candle[], lookback = 60): Divergence {
  if (c.length < lookback + 4) return null;
  const slice = c.slice(-lookback);
  const cl = closes(slice);
  const r = rsi(cl, 14);

  const swingLows: number[] = [];
  const swingHighs: number[] = [];
  for (let i = 2; i < slice.length - 2; i++) {
    if (cl[i] < cl[i - 1] && cl[i] < cl[i - 2] && cl[i] < cl[i + 1] && cl[i] < cl[i + 2]) {
      swingLows.push(i);
    }
    if (cl[i] > cl[i - 1] && cl[i] > cl[i - 2] && cl[i] > cl[i + 1] && cl[i] > cl[i + 2]) {
      swingHighs.push(i);
    }
  }

  if (swingLows.length >= 2) {
    const [i1, i2] = swingLows.slice(-2);
    if (i2 - i1 >= 5 && cl[i2] < cl[i1] && r[i2] > r[i1]) return 'bullish';
  }
  if (swingHighs.length >= 2) {
    const [i1, i2] = swingHighs.slice(-2);
    if (i2 - i1 >= 5 && cl[i2] > cl[i1] && r[i2] < r[i1]) return 'bearish';
  }
  return null;
}
