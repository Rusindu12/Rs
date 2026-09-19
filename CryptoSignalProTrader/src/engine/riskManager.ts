import Big from 'big.js';
import { Trade, PositionInfo } from '../types/trading';
import { Signal } from '../types/signals';
import { AppSettings } from '../types/app';
import { RISK_DEFAULTS } from '../utils/constants';
import { bigMul, bigDiv, bigSub, calculateCorrelation } from '../utils/mathHelpers';

export interface RiskCheckResult {
  approved: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  warnings: string[];
}

export const checkTradeRisk = (
  signal: Signal,
  settings: AppSettings,
  openTrades: Trade[],
  portfolioValue: number,
  dailyPnl: number,
  weeklyPnl: number,
  peakPortfolioValue: number,
  consecutiveLosses: number,
  recentLossTimestamps: number[],
  currentPrice: number
): RiskCheckResult => {
  const warnings: string[] = [];
  let approved = true;
  let reason = '';
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';

  // Check if auto-trading is enabled
  if (!settings.isAutoTrade) {
    return { approved: false, reason: 'Auto-trading is disabled', riskLevel: 'low', warnings };
  }

  // Check minimum confidence
  if (signal.confidence < settings.minConfidence) {
    return {
      approved: false,
      reason: `Confidence ${signal.confidence.toFixed(1)}% below minimum ${settings.minConfidence}%`,
      riskLevel: 'low',
      warnings,
    };
  }

  // Check daily loss limit
  const dailyLossPct = portfolioValue > 0 ? (Math.abs(dailyPnl) / portfolioValue) * 100 : 0;
  if (dailyPnl < 0 && dailyLossPct >= settings.dailyLossLimit) {
    return {
      approved: false,
      reason: `Daily loss ${dailyLossPct.toFixed(2)}% exceeds limit ${settings.dailyLossLimit}%`,
      riskLevel: 'extreme',
      warnings: ['Daily loss circuit breaker triggered'],
    };
  }

  // Check weekly loss limit
  const weeklyLossPct = portfolioValue > 0 ? (Math.abs(weeklyPnl) / portfolioValue) * 100 : 0;
  if (weeklyPnl < 0 && weeklyLossPct >= settings.weeklyLossLimit) {
    return {
      approved: false,
      reason: `Weekly loss ${weeklyLossPct.toFixed(2)}% exceeds limit ${settings.weeklyLossLimit}%`,
      riskLevel: 'extreme',
      warnings: ['Weekly loss limit reached'],
    };
  }

  // Check max drawdown
  const drawdown = peakPortfolioValue > 0
    ? ((peakPortfolioValue - portfolioValue) / peakPortfolioValue) * 100
    : 0;
  if (drawdown >= settings.maxDrawdownPct) {
    return {
      approved: false,
      reason: `Drawdown ${drawdown.toFixed(2)}% exceeds maximum ${settings.maxDrawdownPct}%`,
      riskLevel: 'extreme',
      warnings: ['Max drawdown protection triggered'],
    };
  }

  // Check max open trades
  if (openTrades.length >= settings.maxOpenTrades) {
    return {
      approved: false,
      reason: `Maximum ${settings.maxOpenTrades} open trades reached`,
      riskLevel: 'medium',
      warnings,
    };
  }

  // Check max trades on same pair
  const samePairTrades = openTrades.filter(t => t.symbol === signal.symbol && t.status === 'OPEN');
  if (samePairTrades.length >= RISK_DEFAULTS.MAX_SAME_PAIR_TRADES) {
    return {
      approved: false,
      reason: `Maximum ${RISK_DEFAULTS.MAX_SAME_PAIR_TRADES} trades on ${signal.symbol} reached`,
      riskLevel: 'medium',
      warnings,
    };
  }

  // Check consecutive losses
  if (consecutiveLosses >= RISK_DEFAULTS.CONSECUTIVE_LOSS_HALT) {
    return {
      approved: false,
      reason: `${consecutiveLosses} consecutive losses - circuit breaker active`,
      riskLevel: 'high',
      warnings: ['Circuit breaker: consecutive losses limit reached'],
    };
  }

  // Check cooldown
  const now = Date.now();
  const recentLossOnPair = recentLossTimestamps.some(
    t => now - t < settings.cooldownSeconds * 1000
  );
  if (recentLossOnPair) {
    return {
      approved: false,
      reason: `Cooldown period active (${settings.cooldownSeconds}s)`,
      riskLevel: 'medium',
      warnings,
    };
  }

  // Correlation check
  if (openTrades.length > 0) {
    const correlatedPairs = getCorrelatedPairs(signal.symbol);
    const correlatedOpen = openTrades.filter(
      t => correlatedPairs.includes(t.symbol) && t.side === signal.signalType.includes('BUY') ? 'BUY' : 'SELL'
    );
    if (correlatedOpen.length > 0) {
      warnings.push(`Correlated pair(s) already open: ${correlatedOpen.map(t => t.symbol).join(', ')}`);
      riskLevel = 'medium';
    }
  }

  // Slippage check based on signal confidence
  if (signal.confidence < 50) {
    riskLevel = 'high';
    warnings.push('Low confidence signal - consider reducing position size');
  }

  if (drawdown >= settings.maxDrawdownPct * 0.7) {
    riskLevel = 'high';
    warnings.push('Approaching max drawdown limit');
  }

  return { approved, reason: approved ? 'Trade approved' : reason, riskLevel, warnings };
};

const getCorrelatedPairs = (symbol: string): string[] => {
  const correlationMap: Record<string, string[]> = {
    BTCUSDT: ['ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
    ETHUSDT: ['BTCUSDT', 'BNBUSDT', 'MATICUSDT', 'LINKUSDT'],
    BNBUSDT: ['BTCUSDT', 'ETHUSDT'],
    SOLUSDT: ['BTCUSDT', 'AVAXUSDT', 'NEARUSDT'],
    ADAUSDT: ['DOTUSDT', 'AVAXUSDT'],
    XRPUSDT: ['ADAUSDT', 'DOGEUSDT'],
    DOTUSDT: ['ADAUSDT', 'ATOMUSDT'],
    AVAXUSDT: ['SOLUSDT', 'NEARUSDT', 'MATICUSDT'],
    MATICUSDT: ['ETHUSDT', 'AVAXUSDT'],
    LINKUSDT: ['ETHUSDT', 'UNIUSDT'],
    LTCUSDT: ['BTCUSDT'],
    DOGEUSDT: ['XRPUSDT', 'SHIBUSDT'],
  };
  return correlationMap[symbol] || [];
};

export const checkFlashCrash = (
  recentPrices: number[],
  timeframeMs: number = 5 * 60 * 1000,
  thresholdPct: number = RISK_DEFAULTS.FLASH_CRASH_THRESHOLD
): boolean => {
  if (recentPrices.length < 2) return false;
  const maxPrice = Math.max(...recentPrices);
  const minPrice = Math.min(...recentPrices);
  const dropPct = ((maxPrice - minPrice) / maxPrice) * 100;
  return dropPct >= thresholdPct;
};

export const checkSpreadLimit = (
  bidPrice: number,
  askPrice: number,
  maxSpreadPct: number = RISK_DEFAULTS.SPREAD_LIMIT_PCT
): { withinLimit: boolean; spreadPct: number } => {
  if (askPrice <= 0) return { withinLimit: false, spreadPct: 0 };
  const spreadPct = ((askPrice - bidPrice) / askPrice) * 100;
  return { withinLimit: spreadPct <= maxSpreadPct, spreadPct };
};

export const shouldEmergencyClose = (
  apiDisconnectedSince: number | null,
  portfolioDropPct: number,
  maxDrawdownPct: number
): { shouldClose: boolean; reason: string } => {
  if (apiDisconnectedSince && Date.now() - apiDisconnectedSince > RISK_DEFAULTS.API_DISCONNECT_TIMEOUT_MS) {
    return { shouldClose: true, reason: 'API disconnected for >2 minutes' };
  }
  if (portfolioDropPct >= maxDrawdownPct) {
    return { shouldClose: true, reason: `Portfolio dropped ${portfolioDropPct.toFixed(2)}%` };
  }
  return { shouldClose: false, reason: '' };
};
