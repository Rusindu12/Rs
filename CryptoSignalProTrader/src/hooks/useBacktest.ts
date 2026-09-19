import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setRunning, setProgress, addResult, setError } from '../store/slices/backtestSlice';
import { binanceRest } from '../api/binanceRest';
import { runBacktest, BacktestConfig } from '../engine/backtestEngine';
import { Timeframe } from '../types/signals';
import { KlineInterval } from '../types/binance';

export const useBacktest = () => {
  const dispatch = useAppDispatch();
  const { results, currentResult, isRunning, progress, error } = useAppSelector(state => state.backtest);

  const startBacktest = useCallback(async (config: {
    symbol: string;
    timeframe: Timeframe;
    startDate: string;
    endDate: string;
    initialCapital: number;
    strategy: string;
    maxTradePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    minConfidence: number;
  }) => {
    try {
      dispatch(setRunning(true));
      dispatch(setProgress(10));

      const startTs = new Date(config.startDate).getTime();
      const endTs = new Date(config.endDate).getTime();

      const allKlines: any[] = [];
      let currentStart = startTs;
      while (currentStart < endTs) {
        const klines = await binanceRest.getKlines(
          config.symbol,
          config.timeframe as KlineInterval,
          1000,
          currentStart,
          endTs
        );
        if (klines.length === 0) break;
        allKlines.push(...klines);
        currentStart = klines[klines.length - 1].openTime + 1;
        dispatch(setProgress(Math.min(80, 10 + (allKlines.length / 100) * 70)));
      }

      dispatch(setProgress(90));

      const backtestConfig: BacktestConfig = {
        symbol: config.symbol,
        timeframe: config.timeframe,
        klines: allKlines,
        initialCapital: config.initialCapital,
        maxTradePct: config.maxTradePct,
        stopLossPct: config.stopLossPct,
        takeProfitPct: config.takeProfitPct,
        minConfidence: config.minConfidence,
        strategy: config.strategy,
        feeRate: 0.001,
        maxOpenTrades: 5,
        startDate: config.startDate,
        endDate: config.endDate,
      };

      const result = runBacktest(backtestConfig);
      dispatch(addResult(result));
      dispatch(setProgress(100));
      return result;
    } catch (err: any) {
      dispatch(setError(err.message));
      return null;
    }
  }, [dispatch]);

  return { results, currentResult, isRunning, progress, error, startBacktest };
};
