import Big from 'big.js';
import { BinanceKline } from '../types/binance';
import { BacktestResult, EquityPoint, BacktestTrade } from '../types/app';
import { generateSignal, parseKlines } from './signalEngine';
import { SignalType, Timeframe, DEFAULT_INDICATOR_WEIGHTS } from '../types/signals';
import { calculateStopLoss, calculateTakeProfit } from '../utils/quantityCalculator';
import { calculateFee, calculateSharpeRatio, calculateSortinoRatio, calculateMaxDrawdown, calculateProfitFactor, calculateCAGR } from '../utils/mathHelpers';
import { RISK_DEFAULTS } from '../utils/constants';

export interface BacktestConfig {
  symbol: string;
  timeframe: Timeframe;
  klines: BinanceKline[];
  initialCapital: number;
  maxTradePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  minConfidence: number;
  strategy: string;
  feeRate: number;
  maxOpenTrades: number;
  startDate: string;
  endDate: string;
}

export const runBacktest = (config: BacktestConfig): BacktestResult => {
  const {
    klines, initialCapital, maxTradePct, stopLossPct, takeProfitPct,
    minConfidence, strategy, feeRate, maxOpenTrades, symbol, timeframe,
    startDate, endDate,
  } = config;

  let capital = initialCapital;
  let peakCapital = initialCapital;
  const equityCurve: EquityPoint[] = [];
  const trades: BacktestTrade[] = [];
  const openPositions: { entryPrice: number; quantity: number; side: 'BUY' | 'SELL'; entryTime: string; entryIndex: number }[] = [];
  const dailyReturns: number[] = [];
  let prevEquity = initialCapital;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let lastEquityDate = '';

  const minBars = 60;

  for (let i = minBars; i < klines.length; i++) {
    const windowKlines = klines.slice(0, i + 1);
    const currentKline = klines[i];
    const currentPrice = parseFloat(currentKline.close);
    const currentTime = new Date(currentKline.openTime).toISOString();
    const currentDate = currentTime.split('T')[0];

    // Check stop-loss and take-profit for open positions
    for (let j = openPositions.length - 1; j >= 0; j--) {
      const pos = openPositions[j];
      const priceChange = pos.side === 'BUY'
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;

      let exitReason = '';
      if (pos.side === 'BUY' && currentPrice <= pos.entryPrice * (1 - stopLossPct / 100)) exitReason = 'Stop Loss';
      else if (pos.side === 'BUY' && currentPrice >= pos.entryPrice * (1 + takeProfitPct / 100)) exitReason = 'Take Profit';
      else if (pos.side === 'SELL' && currentPrice >= pos.entryPrice * (1 + stopLossPct / 100)) exitReason = 'Stop Loss';
      else if (pos.side === 'SELL' && currentPrice <= pos.entryPrice * (1 - takeProfitPct / 100)) exitReason = 'Take Profit';

      if (exitReason) {
        const pnl = pos.side === 'BUY'
          ? (currentPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - currentPrice) * pos.quantity;
        const entryFee = pos.entryPrice * pos.quantity * feeRate;
        const exitFee = currentPrice * pos.quantity * feeRate;
        const netPnl = pnl - entryFee - exitFee;
        capital += netPnl;

        trades.push({
          symbol, side: pos.side, entryPrice: pos.entryPrice, exitPrice: currentPrice,
          quantity: pos.quantity, pnl: netPnl, pnlPercent: priceChange * 100,
          entryTime: pos.entryTime, exitTime: currentTime,
          duration: new Date(currentTime).getTime() - new Date(pos.entryTime).getTime(),
          signalType: pos.side === 'BUY' ? 'BUY' : 'SELL',
        });

        if (netPnl > 0) {
          currentWinStreak++;
          currentLossStreak = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
        } else {
          currentLossStreak++;
          currentWinStreak = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
        }

        openPositions.splice(j, 1);
      }
    }

    // Generate signal
    if (openPositions.length < maxOpenTrades) {
      const signal = generateSignal(windowKlines, timeframe);
      const isBuySignal = ['STRONG_BUY', 'BUY'].includes(signal.signalType) && signal.confidence >= minConfidence;
      const isSellSignal = ['STRONG_SELL', 'SELL'].includes(signal.signalType) && signal.confidence >= minConfidence;

      if (isBuySignal || isSellSignal) {
        const side: 'BUY' | 'SELL' = isBuySignal ? 'BUY' : 'SELL';
        const tradeAmount = capital * (maxTradePct / 100);
        const quantity = tradeAmount / currentPrice;
        const fee = currentPrice * quantity * feeRate;
        capital -= fee;

        openPositions.push({
          entryPrice: currentPrice,
          quantity,
          side,
          entryTime: currentTime,
          entryIndex: i,
        });
      }
    }

    // Calculate unrealized PnL for equity curve
    let unrealizedPnl = 0;
    for (const pos of openPositions) {
      unrealizedPnl += pos.side === 'BUY'
        ? (currentPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentPrice) * pos.quantity;
    }

    const equity = capital + unrealizedPnl;
    peakCapital = Math.max(peakCapital, equity);
    const drawdown = peakCapital > 0 ? (peakCapital - equity) / peakCapital : 0;

    equityCurve.push({
      timestamp: currentTime,
      equity,
      drawdown,
    });

    // Track daily returns
    if (currentDate !== lastEquityDate && lastEquityDate !== '') {
      const dailyReturn = (equity - prevEquity) / prevEquity;
      dailyReturns.push(dailyReturn);
      prevEquity = equity;
    }
    lastEquityDate = currentDate;
  }

  // Close remaining positions at last price
  const lastPrice = parseFloat(klines[klines.length - 1].close);
  for (const pos of openPositions) {
    const pnl = pos.side === 'BUY'
      ? (lastPrice - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - lastPrice) * pos.quantity;
    const entryFee = pos.entryPrice * pos.quantity * feeRate;
    const exitFee = lastPrice * pos.quantity * feeRate;
    const netPnl = pnl - entryFee - exitFee;
    capital += netPnl;

    trades.push({
      symbol, side: pos.side, entryPrice: pos.entryPrice, exitPrice: lastPrice,
      quantity: pos.quantity, pnl: netPnl, pnlPercent: pos.side === 'BUY'
        ? ((lastPrice - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - lastPrice) / pos.entryPrice) * 100,
      entryTime: pos.entryTime, exitTime: klines[klines.length - 1].openTime.toString(),
      duration: Date.now() - new Date(pos.entryTime).getTime(),
      signalType: 'CLOSE',
    });
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const equityValues = equityCurve.map(e => e.equity);
  const days = klines.length > 0
    ? (klines[klines.length - 1].openTime - klines[0].openTime) / 86400000
    : 365;
  const years = days / 365;

  return {
    id: Date.now(),
    symbol,
    timeframe,
    strategy,
    startDate,
    endDate,
    initialCapital,
    finalCapital: capital,
    totalReturn: ((capital - initialCapital) / initialCapital) * 100,
    cagr: calculateCAGR(initialCapital, capital, years),
    maxDrawdown: calculateMaxDrawdown(equityValues),
    sharpeRatio: calculateSharpeRatio(dailyReturns),
    sortinoRatio: calculateSortinoRatio(dailyReturns),
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    profitFactor: calculateProfitFactor(wins.map(w => w.pnl), losses.map(l => l.pnl)),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    avgWin: wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0,
    avgLoss: losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    equityCurve,
    trades,
    createdAt: new Date().toISOString(),
  };
};

export const runMonteCarloSimulation = (
  trades: BacktestTrade[],
  initialCapital: number,
  iterations: number = 1000
): { percentile5: number; percentile25: number; median: number; percentile75: number; percentile95: number } => {
  const pnls = trades.map(t => t.pnl);
  if (pnls.length === 0) return { percentile5: initialCapital, percentile25: initialCapital, median: initialCapital, percentile75: initialCapital, percentile95: initialCapital };

  const finalValues: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let capital = initialCapital;
    const shuffled = [...pnls].sort(() => Math.random() - 0.5);
    for (const pnl of shuffled) {
      capital += pnl;
    }
    finalValues.push(capital);
  }

  finalValues.sort((a, b) => a - b);
  const getPercentile = (pct: number) => finalValues[Math.floor(finalValues.length * pct / 100)];

  return {
    percentile5: getPercentile(5),
    percentile25: getPercentile(25),
    median: getPercentile(50),
    percentile75: getPercentile(75),
    percentile95: getPercentile(95),
  };
};
