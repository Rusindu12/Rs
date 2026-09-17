/**
 * Training data: live Binance klines (public, keyless) with an offline
 * synthetic fallback so the pipeline always produces a model.
 */
import type { Candle } from '../src/indicators/indicators';
import { ENGINE_TIMEFRAMES, DEFAULT_SYMBOLS, type Timeframe } from '../src/config';

const REST = 'https://api.binance.com';

async function fetchJson<T>(url: string, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchKlines(symbol: string, interval: Timeframe, limit = 1000): Promise<Candle[]> {
  const rows = await fetchJson<unknown[][]>(
    `${REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  return rows.map((r) => ({
    openTime: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
    closeTime: Number(r[6]),
    quoteVolume: Number(r[7]),
    trades: Number(r[8]),
  }));
}

/* ------------------------- synthetic fallback ---------------------------- */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * Regime-switching GBM: trending up/down phases with noise — rich enough to
 * exercise trend and mean-reversion factors and produce non-degenerate trades.
 */
export function syntheticKlines(symbol: string, interval: Timeframe, limit = 1000): Candle[] {
  const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + interval.length * 131;
  const rand = lcg(seed);
  const out: Candle[] = [];
  let price = 50 + rand() * 150;
  let drift = (rand() - 0.5) * 0.08; // % per bar (±0.04 %)
  const tfMs: Record<string, number> = { '1m': 60e3, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 };
  let t = Date.now() - limit * (tfMs[interval] ?? 9e5);
  for (let i = 0; i < limit; i++) {
    if (rand() < 0.02) drift = (rand() - 0.5) * 0.16; // switch regime
    const noise = price * 0.004 * (rand() - 0.5); // ±0.2 % realistic 15m noise
    const open = price;
    price = Math.max(0.01, price * (1 + drift / 100) + noise);
    const high = Math.max(open, price) * (1 + rand() * 0.004);
    const low = Math.min(open, price) * (1 - rand() * 0.004);
    const vol = 1000 * (0.5 + rand()) * (rand() < 0.03 ? 2.5 : 1); // occasional spikes
    out.push({
      openTime: t,
      open,
      high,
      low,
      close: price,
      volume: vol,
      closeTime: t + (tfMs[interval] ?? 9e5) - 1,
      quoteVolume: vol * price,
      trades: Math.round(50 + rand() * 200),
    });
    t += tfMs[interval] ?? 9e5;
  }
  return out;
}

export interface TrainingSet {
  symbol: string;
  primary: Candle[]; // 15m
  candles: Partial<Record<Timeframe, Candle[]>>;
  live: boolean;
}

export async function loadTrainingSet(
  symbols: string[],
  bars: number,
  mode: 'live' | 'synthetic'
): Promise<{ sets: TrainingSet[]; live: boolean }> {
  const sets: TrainingSet[] = [];
  let live = mode === 'live';
  if (live) {
    try {
      for (const symbol of symbols) {
        const primary = await fetchKlines(symbol, '15m', bars);
        const candles: Partial<Record<Timeframe, Candle[]>> = { '15m': primary };
        for (const tf of ENGINE_TIMEFRAMES) {
          if (tf === '15m') continue;
          candles[tf] = await fetchKlines(symbol, tf, bars);
        }
        sets.push({ symbol, primary, candles, live: true });
        console.log(`  fetched ${symbol}: ${primary.length} × 15m bars + ${ENGINE_TIMEFRAMES.length - 1} timeframes`);
      }
    } catch (e) {
      console.warn(`live fetch failed (${String(e)}) — falling back to synthetic data`);
      live = false;
      sets.length = 0;
    }
  }
  if (!sets.length) {
    for (const symbol of symbols) {
      const primary = syntheticKlines(symbol, '15m', bars);
      const candles: Partial<Record<Timeframe, Candle[]>> = { '15m': primary };
      for (const tf of ENGINE_TIMEFRAMES) {
        if (tf === '15m') continue;
        candles[tf] = syntheticKlines(symbol, tf, bars);
      }
      sets.push({ symbol, primary, candles, live: false });
    }
  }
  return { sets, live };
}

export { DEFAULT_SYMBOLS };
