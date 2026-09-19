import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BacktestResult } from '../../types/app';

interface BacktestState {
  results: BacktestResult[];
  currentResult: BacktestResult | null;
  isRunning: boolean;
  progress: number;
  error: string | null;
}

const initialState: BacktestState = {
  results: [],
  currentResult: null,
  isRunning: false,
  progress: 0,
  error: null,
};

const backtestSlice = createSlice({
  name: 'backtest',
  initialState,
  reducers: {
    setRunning: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload;
      if (action.payload) state.progress = 0;
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    setCurrentResult: (state, action: PayloadAction<BacktestResult | null>) => {
      state.currentResult = action.payload;
    },
    addResult: (state, action: PayloadAction<BacktestResult>) => {
      state.results.unshift(action.payload);
      state.currentResult = action.payload;
      state.isRunning = false;
      state.progress = 100;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) state.isRunning = false;
    },
    clearResults: (state) => {
      state.results = [];
      state.currentResult = null;
    },
  },
});

export const { setRunning, setProgress, setCurrentResult, addResult, setError, clearResults } = backtestSlice.actions;
export default backtestSlice.reducer;
