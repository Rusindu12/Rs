import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Trade, TradeStats } from '../../types/trading';

interface TradeState {
  openTrades: Trade[];
  closedTrades: Trade[];
  allTrades: Trade[];
  stats: TradeStats | null;
  dailyPnl: number;
  weeklyPnl: number;
  totalPnl: number;
  portfolioValue: number;
  peakPortfolioValue: number;
  consecutiveLosses: number;
  isLoading: boolean;
}

const initialState: TradeState = {
  openTrades: [],
  closedTrades: [],
  allTrades: [],
  stats: null,
  dailyPnl: 0,
  weeklyPnl: 0,
  totalPnl: 0,
  portfolioValue: 0,
  peakPortfolioValue: 0,
  consecutiveLosses: 0,
  isLoading: false,
};

const tradeSlice = createSlice({
  name: 'trades',
  initialState,
  reducers: {
    setOpenTrades: (state, action: PayloadAction<Trade[]>) => {
      state.openTrades = action.payload;
    },
    addOpenTrade: (state, action: PayloadAction<Trade>) => {
      state.openTrades.push(action.payload);
      state.allTrades.unshift(action.payload);
    },
    closeTrade: (state, action: PayloadAction<Trade>) => {
      state.openTrades = state.openTrades.filter(t => t.id !== action.payload.id);
      state.closedTrades.unshift(action.payload);
      const idx = state.allTrades.findIndex(t => t.id === action.payload.id);
      if (idx >= 0) state.allTrades[idx] = action.payload;

      if (action.payload.netPnl !== null) {
        state.dailyPnl += action.payload.netPnl;
        state.weeklyPnl += action.payload.netPnl;
        state.totalPnl += action.payload.netPnl;

        if (action.payload.netPnl < 0) {
          state.consecutiveLosses++;
        } else {
          state.consecutiveLosses = 0;
        }
      }
    },
    setClosedTrades: (state, action: PayloadAction<Trade[]>) => {
      state.closedTrades = action.payload;
    },
    setAllTrades: (state, action: PayloadAction<Trade[]>) => {
      state.allTrades = action.payload;
    },
    setStats: (state, action: PayloadAction<TradeStats>) => {
      state.stats = action.payload;
    },
    setDailyPnl: (state, action: PayloadAction<number>) => {
      state.dailyPnl = action.payload;
    },
    setWeeklyPnl: (state, action: PayloadAction<number>) => {
      state.weeklyPnl = action.payload;
    },
    setPortfolioValue: (state, action: PayloadAction<number>) => {
      state.portfolioValue = action.payload;
      if (action.payload > state.peakPortfolioValue) {
        state.peakPortfolioValue = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetConsecutiveLosses: (state) => {
      state.consecutiveLosses = 0;
    },
  },
});

export const {
  setOpenTrades, addOpenTrade, closeTrade, setClosedTrades,
  setAllTrades, setStats, setDailyPnl, setWeeklyPnl,
  setPortfolioValue, setLoading, resetConsecutiveLosses,
} = tradeSlice.actions;
export default tradeSlice.reducer;
