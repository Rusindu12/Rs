import { create } from 'zustand';
import type { MiniTicker } from '../services/binance/ws';

export interface TickerView {
  symbol: string;
  price: number;
  changePct: number;
  quoteVolume: number;
  /** Recent price points (ring buffer) for sparklines. */
  history: number[];
  updatedAt: number;
}

interface MarketState {
  tickers: Record<string, TickerView>;
  lastUpdateAt: number;
  applyTickers: (t: MiniTicker[]) => void;
  seedTicker: (symbol: string, price: number, changePct: number, quoteVolume: number) => void;
  reset: () => void;
}

const HISTORY_MAX = 90;

export const useMarketStore = create<MarketState>()((set, get) => ({
  tickers: {},
  lastUpdateAt: 0,

  applyTickers: (incoming) => {
    const tickers = { ...get().tickers };
    let changed = 0;
    for (const t of incoming) {
      const prev = tickers[t.symbol];
      const history = prev ? [...prev.history, t.close] : [t.close];
      if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
      tickers[t.symbol] = {
        symbol: t.symbol,
        price: t.close,
        changePct: t.open > 0 ? ((t.close - t.open) / t.open) * 100 : 0,
        quoteVolume: t.quoteVolume,
        history,
        updatedAt: Date.now(),
      };
      changed++;
    }
    if (changed) set({ tickers, lastUpdateAt: Date.now() });
  },

  seedTicker: (symbol, price, changePct, quoteVolume) => {
    const tickers = { ...get().tickers };
    const prev = tickers[symbol];
    tickers[symbol] = {
      symbol,
      price,
      changePct,
      quoteVolume,
      history: prev?.history.length ? prev.history : [price],
      updatedAt: Date.now(),
    };
    set({ tickers });
  },

  reset: () => set({ tickers: {}, lastUpdateAt: 0 }),
}));

/** Bullish / Bearish / Neutral market sentiment from aggregate 24h change. */
export function marketSentiment(tickers: Record<string, TickerView>): {
  label: 'Bullish' | 'Bearish' | 'Neutral';
  avgChangePct: number;
} {
  const list = Object.values(tickers);
  if (!list.length) return { label: 'Neutral', avgChangePct: 0 };
  const avg = list.reduce((s, t) => s + t.changePct, 0) / list.length;
  return { label: avg > 1 ? 'Bullish' : avg < -1 ? 'Bearish' : 'Neutral', avgChangePct: avg };
}
