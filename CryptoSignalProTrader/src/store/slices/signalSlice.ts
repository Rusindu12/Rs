import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Signal, ScanResult } from '../../types/signals';

interface SignalState {
  signals: Signal[];
  scanResults: ScanResult[];
  lastScanTime: number | null;
  isScanning: boolean;
  selectedSignal: Signal | null;
  unreadCount: number;
}

const initialState: SignalState = {
  signals: [],
  scanResults: [],
  lastScanTime: null,
  isScanning: false,
  selectedSignal: null,
  unreadCount: 0,
};

const signalSlice = createSlice({
  name: 'signals',
  initialState,
  reducers: {
    addSignal: (state, action: PayloadAction<Signal>) => {
      state.signals.unshift(action.payload);
      if (state.signals.length > 200) state.signals = state.signals.slice(0, 200);
      state.unreadCount++;
    },
    setSignals: (state, action: PayloadAction<Signal[]>) => {
      state.signals = action.payload;
    },
    setScanResults: (state, action: PayloadAction<ScanResult[]>) => {
      state.scanResults = action.payload;
      state.lastScanTime = Date.now();
    },
    setScanning: (state, action: PayloadAction<boolean>) => {
      state.isScanning = action.payload;
    },
    setSelectedSignal: (state, action: PayloadAction<Signal | null>) => {
      state.selectedSignal = action.payload;
    },
    markSignalActedOn: (state, action: PayloadAction<number>) => {
      const signal = state.signals.find(s => s.id === action.payload);
      if (signal) signal.wasActedOn = true;
    },
    clearUnread: (state) => {
      state.unreadCount = 0;
    },
  },
});

export const { addSignal, setSignals, setScanResults, setScanning, setSelectedSignal, markSignalActedOn, clearUnread } = signalSlice.actions;
export default signalSlice.reducer;
