import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
}

interface MarketState {
  prices: Record<string, PriceData>;
  selectedSymbol: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastUpdate: number;
  serverTimeOffset: number;
}

const initialState: MarketState = {
  prices: {},
  selectedSymbol: 'BTCUSDT',
  connectionStatus: 'disconnected',
  lastUpdate: 0,
  serverTimeOffset: 0,
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    updatePrice: (state, action: PayloadAction<PriceData>) => {
      state.prices[action.payload.symbol] = action.payload;
      state.lastUpdate = Date.now();
    },
    updatePrices: (state, action: PayloadAction<PriceData[]>) => {
      for (const price of action.payload) {
        state.prices[price.symbol] = price;
      }
      state.lastUpdate = Date.now();
    },
    setSelectedSymbol: (state, action: PayloadAction<string>) => {
      state.selectedSymbol = action.payload;
    },
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'connecting' | 'disconnected'>) => {
      state.connectionStatus = action.payload;
    },
    setServerTimeOffset: (state, action: PayloadAction<number>) => {
      state.serverTimeOffset = action.payload;
    },
  },
});

export const { updatePrice, updatePrices, setSelectedSymbol, setConnectionStatus, setServerTimeOffset } = marketSlice.actions;
export default marketSlice.reducer;
