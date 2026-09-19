import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { addOpenTrade, closeTrade, setPortfolioValue } from '../store/slices/tradeSlice';
import { tradingEngine } from '../engine/tradingEngine';
import { tradingService } from '../background/tradingService';
import { Signal } from '../types/signals';
import { saveTrade } from '../services/databaseService';
import { sendTradeNotification } from '../services/notificationService';

export const useTrading = () => {
  const dispatch = useAppDispatch();
  const { openTrades, stats, dailyPnl, portfolioValue, peakPortfolioValue, consecutiveLosses } = useAppSelector(state => state.trades);
  const { settings } = useAppSelector(state => state.settings);

  const executeSignal = useCallback(async (signal: Signal) => {
    const result = await tradingEngine.executeSignal(
      signal, settings, openTrades, portfolioValue,
      dailyPnl, 0, peakPortfolioValue, consecutiveLosses
    );
    if (result.success && result.trade) {
      dispatch(addOpenTrade(result.trade));
      await saveTrade(result.trade);
      await sendTradeNotification(result.trade.symbol, result.trade.side, result.trade.entryPrice);
    }
    return result;
  }, [dispatch, settings, openTrades, portfolioValue, dailyPnl, peakPortfolioValue, consecutiveLosses]);

  const closePosition = useCallback(async (tradeId: number, currentPrice: number, reason: string) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return null;
    const closed = await tradingEngine.closeTrade(trade, currentPrice, reason);
    dispatch(closeTrade(closed));
    await saveTrade(closed);
    return closed;
  }, [dispatch, openTrades]);

  const panicCloseAll = useCallback(async () => {
    await tradingService.emergencyCloseAll();
  }, []);

  return { openTrades, stats, executeSignal, closePosition, panicCloseAll };
};
