import Big from 'big.js';
import { kellyCriterion, bigMul, bigDiv, bigSub } from '../utils/mathHelpers';
import { RISK_DEFAULTS } from '../utils/constants';

export interface PositionSizeResult {
  quantity: number;
  dollarAmount: number;
  riskAmount: number;
  riskPercent: number;
  method: string;
  kellyFraction: number | null;
}

export const calculatePositionSize = (
  portfolioValue: number,
  currentPrice: number,
  stopLossPrice: number,
  side: 'BUY' | 'SELL',
  maxTradePct: number = RISK_DEFAULTS.MAX_TRADE_PCT,
  winRate?: number,
  avgWin?: number,
  avgLoss?: number
): PositionSizeResult => {
  const maxDollarAmount = bigMul(portfolioValue, bigDiv(maxTradePct, 100));
  const riskPerUnit = Math.abs(bigSub(currentPrice, stopLossPrice));
  const riskPercent = riskPerUnit / currentPrice;
  const riskAmount = bigMul(maxDollarAmount, 0.5);

  let kellyFraction: number | null = null;
  let dollarAmount: number;

  if (winRate !== undefined && avgWin !== undefined && avgLoss !== undefined && avgLoss > 0) {
    kellyFraction = kellyCriterion(winRate, avgWin, avgLoss);
    const halfKelly = kellyFraction * 0.5;
    dollarAmount = Math.min(maxDollarAmount, bigMul(portfolioValue, halfKelly));
  } else if (riskPerUnit > 0) {
    dollarAmount = Math.min(maxDollarAmount, bigDiv(riskAmount, riskPercent));
  } else {
    dollarAmount = maxDollarAmount;
  }

  dollarAmount = Math.max(0, Math.min(dollarAmount, maxDollarAmount));
  const quantity = currentPrice > 0 ? bigDiv(dollarAmount, currentPrice) : 0;

  return {
    quantity,
    dollarAmount,
    riskAmount: bigMul(quantity, riskPerUnit),
    riskPercent: riskPercent * 100,
    method: kellyFraction !== null ? 'Kelly Criterion (Half-Kelly)' : 'Fixed Percentage',
    kellyFraction,
  };
};

export const calculateDCAAmount = (
  totalInvestment: number,
  intervals: number,
  priceDeviation: number = 0
): number[] => {
  const baseAmount = totalInvestment / intervals;
  const amounts: number[] = [];
  for (let i = 0; i < intervals; i++) {
    const factor = 1 + (priceDeviation * (i / intervals));
    amounts.push(baseAmount * factor);
  }
  return amounts;
};

export const calculateGridLevels = (
  lowerPrice: number,
  upperPrice: number,
  gridCount: number,
  totalInvestment: number
): { price: number; amount: number }[] => {
  const investmentPerGrid = totalInvestment / gridCount;
  const priceStep = (upperPrice - lowerPrice) / (gridCount - 1);
  const levels: { price: number; amount: number }[] = [];
  for (let i = 0; i < gridCount; i++) {
    const price = lowerPrice + priceStep * i;
    levels.push({ price, amount: investmentPerGrid / price });
  }
  return levels;
};
