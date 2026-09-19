import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { addSignal, setScanning, setScanResults, clearUnread } from '../store/slices/signalSlice';
import { binanceRest } from '../api/binanceRest';
import { generateSignal } from '../engine/signalEngine';
import { Signal, Timeframe } from '../types/signals';
import { getRecentSignals } from '../services/databaseService';

export const useSignals = () => {
  const dispatch = useAppDispatch();
  const { signals, isScanning, scanResults, unreadCount } = useAppSelector(state => state.signals);
  const { settings } = useAppSelector(state => state.settings);

  const scanPair = useCallback(async (symbol: string, timeframe: Timeframe = '5m') => {
    try {
      dispatch(setScanning(true));
      const klines = await binanceRest.getKlines(symbol, timeframe, 200);
      const breakdown = generateSignal(klines, timeframe);

      const signal: Signal = {
        id: Date.now(),
        symbol,
        signalType: breakdown.signalType,
        score: breakdown.totalScore,
        confidence: breakdown.confidence,
        marketRegime: breakdown.marketRegime,
        rsiValue: breakdown.indicators[0]?.value || 0,
        macdValue: breakdown.indicators[1]?.value || 0,
        macdSignal: 0,
        macdHistogram: 0,
        bbUpper: 0,
        bbLower: 0,
        bbPercent: 0,
        ema9: 0,
        ema21: 0,
        ema50: 0,
        stochRsiK: 0,
        stochRsiD: 0,
        atrValue: 0,
        adxValue: 0,
        volumeRatio: 1,
        timeframe,
        priceAtSignal: parseFloat(klines[klines.length - 1].close),
        wasActedOn: false,
        outcome: null,
        outcomePnl: null,
        createdAt: new Date().toISOString(),
        multiTimeframeAlignment: { '1m': null, '5m': breakdown.signalType, '15m': null, '1h': null, '4h': null, '1d': null, alignmentScore: 0, confirmingTimeframes: 1 },
      };

      dispatch(addSignal(signal));
      dispatch(setScanning(false));
      return signal;
    } catch (error) {
      dispatch(setScanning(false));
      return null;
    }
  }, [dispatch]);

  const loadRecentSignals = useCallback(async () => {
    const recentSignals = await getRecentSignals(50);
    // Load into store
  }, [dispatch]);

  const clearSignals = useCallback(() => {
    dispatch(clearUnread());
  }, [dispatch]);

  return { signals, isScanning, scanResults, unreadCount, scanPair, loadRecentSignals, clearSignals };
};
