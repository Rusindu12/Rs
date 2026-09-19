import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import userReducer from './slices/userSlice';
import marketReducer from './slices/marketSlice';
import signalReducer from './slices/signalSlice';
import tradeReducer from './slices/tradeSlice';
import settingsReducer from './slices/settingsSlice';
import botReducer from './slices/botSlice';
import backtestReducer from './slices/backtestSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    market: marketReducer,
    signals: signalReducer,
    trades: tradeReducer,
    settings: settingsReducer,
    bot: botReducer,
    backtest: backtestReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
