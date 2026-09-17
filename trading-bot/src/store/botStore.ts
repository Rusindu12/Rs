import { create } from 'zustand';
import type { BotConfig, Position, Signal, TradeRecord } from '../engine/types';
import { DEFAULT_BOT_CONFIG } from '../engine/tradingBot';

export interface LogLine {
  at: number;
  level: 'info' | 'warn' | 'error' | 'trade';
  message: string;
}

interface BotState {
  config: BotConfig;
  running: boolean;
  positions: Position[];
  trades: TradeRecord[];
  signals: Signal[];
  logs: LogLine[];
  lastTickAt: number | null;
  ticking: boolean;

  setConfig: (patch: Partial<BotConfig>) => void;
  replaceConfig: (c: BotConfig) => void;
  setRunning: (v: boolean) => void;
  setTicking: (v: boolean) => void;
  syncEngine: (s: {
    positions?: Position[];
    trades?: TradeRecord[];
    signals?: Signal[];
    lastTickAt?: number;
    ticking?: boolean;
  }) => void;
  pushLog: (line: LogLine) => void;
  reset: () => void;
}

export const useBotStore = create<BotState>()((set, get) => ({
  config: { ...DEFAULT_BOT_CONFIG, symbols: [] },
  running: false,
  positions: [],
  trades: [],
  signals: [],
  logs: [],
  lastTickAt: null,
  ticking: false,

  setConfig: (patch) => set({ config: { ...get().config, ...patch } }),
  replaceConfig: (config) => set({ config }),
  setRunning: (running) => set({ running }),
  setTicking: (ticking) => set({ ticking }),

  syncEngine: (s) =>
    set((prev) => ({
      positions: s.positions ?? prev.positions,
      trades: s.trades ?? prev.trades,
      signals: s.signals ?? prev.signals,
      lastTickAt: s.lastTickAt ?? prev.lastTickAt,
      ticking: s.ticking ?? prev.ticking,
    })),

  pushLog: (line) => set((prev) => ({ logs: [line, ...prev.logs].slice(0, 200) })),

  reset: () =>
    set({
      config: { ...DEFAULT_BOT_CONFIG, symbols: [] },
      running: false,
      positions: [],
      trades: [],
      signals: [],
      logs: [],
      lastTickAt: null,
      ticking: false,
    }),
}));
