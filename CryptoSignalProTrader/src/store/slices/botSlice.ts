import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BotStatus } from '../../types/app';

interface BotState {
  isActive: boolean;
  isBackgroundRunning: boolean;
  uptime: number;
  activePairs: string[];
  activeTradesCount: number;
  signalsGenerated: number;
  tradesExecuted: number;
  currentPnl: number;
  lastSignalTime: string | null;
  lastTradeTime: string | null;
  serviceHealth: 'healthy' | 'degraded' | 'error';
  errors: string[];
  logs: string[];
  lastStateSave: string | null;
}

const initialState: BotState = {
  isActive: false,
  isBackgroundRunning: false,
  uptime: 0,
  activePairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  activeTradesCount: 0,
  signalsGenerated: 0,
  tradesExecuted: 0,
  currentPnl: 0,
  lastSignalTime: null,
  lastTradeTime: null,
  serviceHealth: 'healthy',
  errors: [],
  logs: [],
  lastStateSave: null,
};

const botSlice = createSlice({
  name: 'bot',
  initialState,
  reducers: {
    setActive: (state, action: PayloadAction<boolean>) => {
      state.isActive = action.payload;
    },
    setBackgroundRunning: (state, action: PayloadAction<boolean>) => {
      state.isBackgroundRunning = action.payload;
    },
    setUptime: (state, action: PayloadAction<number>) => {
      state.uptime = action.payload;
    },
    setActivePairs: (state, action: PayloadAction<string[]>) => {
      state.activePairs = action.payload;
    },
    incrementSignals: (state) => {
      state.signalsGenerated++;
      state.lastSignalTime = new Date().toISOString();
    },
    incrementTrades: (state) => {
      state.tradesExecuted++;
      state.lastTradeTime = new Date().toISOString();
    },
    setPnl: (state, action: PayloadAction<number>) => {
      state.currentPnl = action.payload;
    },
    setServiceHealth: (state, action: PayloadAction<'healthy' | 'degraded' | 'error'>) => {
      state.serviceHealth = action.payload;
    },
    addError: (state, action: PayloadAction<string>) => {
      state.errors.push(action.payload);
      if (state.errors.length > 50) state.errors = state.errors.slice(-50);
    },
    clearErrors: (state) => {
      state.errors = [];
    },
    addLog: (state, action: PayloadAction<string>) => {
      state.logs.push(`[${new Date().toLocaleTimeString()}] ${action.payload}`);
      if (state.logs.length > 200) state.logs = state.logs.slice(-200);
    },
    clearLogs: (state) => {
      state.logs = [];
    },
    updateBotStatus: (state, action: PayloadAction<Partial<BotStatus>>) => {
      const status = action.payload;
      if (status.isActive !== undefined) state.isActive = status.isActive;
      if (status.uptime !== undefined) state.uptime = status.uptime;
      if (status.activeTrades !== undefined) state.activeTradesCount = status.activeTrades;
      if (status.signalsGenerated !== undefined) state.signalsGenerated = status.signalsGenerated;
      if (status.tradesExecuted !== undefined) state.tradesExecuted = status.tradesExecuted;
      if (status.currentPnl !== undefined) state.currentPnl = status.currentPnl;
      if (status.lastSignalTime) state.lastSignalTime = status.lastSignalTime;
      if (status.lastTradeTime) state.lastTradeTime = status.lastTradeTime;
      if (status.serviceHealth) state.serviceHealth = status.serviceHealth;
    },
    setLastStateSave: (state, action: PayloadAction<string>) => {
      state.lastStateSave = action.payload;
    },
  },
});

export const {
  setActive, setBackgroundRunning, setUptime, setActivePairs,
  incrementSignals, incrementTrades, setPnl, setServiceHealth,
  addError, clearErrors, addLog, clearLogs, updateBotStatus, setLastStateSave,
} = botSlice.actions;
export default botSlice.reducer;
