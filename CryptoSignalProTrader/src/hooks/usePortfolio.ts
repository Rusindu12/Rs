import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setPortfolioValue, setOpenTrades, setAllTrades, setDailyPnl } from '../store/slices/tradeSlice';
import { binanceRest } from '../api/binanceRest';
import { getOpenTrades, getAllTrades, getDailyPnl } from '../services/databaseService';

export const usePortfolio = () => {
  const dispatch = useAppDispatch();
  const { portfolioValue, openTrades, stats, dailyPnl, weeklyPnl, totalPnl, peakPortfolioValue } = useAppSelector(state => state.trades);
  const { settings } = useAppSelector(state => state.settings);

  const refreshPortfolio = useCallback(async () => {
    try {
      if (settings.isPaperTrade) {
        const trades = await getOpenTrades();
        dispatch(setOpenTrades(trades));
        const allTrades = await getAllTrades(100);
        dispatch(setAllTrades(allTrades));
        const pnl = await getDailyPnl();
        dispatch(setDailyPnl(pnl));
      } else {
        const account = await binanceRest.getAccount();
        const usdtBalance = account.balances.find(b => b.asset === 'USDT');
        if (usdtBalance) {
          dispatch(setPortfolioValue(parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked)));
        }
      }
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    }
  }, [dispatch, settings]);

  useEffect(() => {
    refreshPortfolio();
    const interval = setInterval(refreshPortfolio, 30000);
    return () => clearInterval(interval);
  }, [refreshPortfolio]);

  return {
    portfolioValue,
    openTrades,
    stats,
    dailyPnl,
    weeklyPnl,
    totalPnl,
    peakPortfolioValue,
    refreshPortfolio,
  };
};
