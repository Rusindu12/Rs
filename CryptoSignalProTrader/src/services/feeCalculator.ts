import Big from 'big.js';
import { RISK_DEFAULTS } from '../utils/constants';

export interface FeeBreakdown {
  entryFee: number;
  exitFee: number;
  totalFee: number;
  feeRate: number;
  netPnl: number;
  grossPnl: number;
  feeImpactPct: number;
}

export const calculateTradeFee = (
  quantity: number,
  price: number,
  isMaker: boolean = false
): number => {
  const rate = isMaker ? RISK_DEFAULTS.MAKER_FEE : RISK_DEFAULTS.TAKER_FEE;
  return new Big(quantity).times(price).times(rate).toNumber();
};

export const calculateFullFeeBreakdown = (
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'BUY' | 'SELL',
  isMakerEntry: boolean = false,
  isMakerExit: boolean = false
): FeeBreakdown => {
  const entryFee = calculateTradeFee(quantity, entryPrice, isMakerEntry);
  const exitFee = calculateTradeFee(quantity, exitPrice, isMakerExit);
  const totalFee = entryFee + exitFee;

  const grossPnl = side === 'BUY'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  const netPnl = grossPnl - totalFee;
  const positionValue = entryPrice * quantity;
  const feeImpactPct = positionValue > 0 ? (totalFee / positionValue) * 100 : 0;

  return {
    entryFee,
    exitFee,
    totalFee,
    feeRate: isMakerEntry ? RISK_DEFAULTS.MAKER_FEE : RISK_DEFAULTS.TAKER_FEE,
    netPnl,
    grossPnl,
    feeImpactPct,
  };
};

export const calculateTotalFees = (
  trades: { quantity: number; entryPrice: number; exitPrice?: number; isMaker?: boolean }[]
): number => {
  return trades.reduce((total, trade) => {
    const entryFee = calculateTradeFee(trade.quantity, trade.entryPrice, trade.isMaker);
    const exitFee = trade.exitPrice ? calculateTradeFee(trade.quantity, trade.exitPrice, trade.isMaker) : 0;
    return total + entryFee + exitFee;
  }, 0);
};

export const estimateFeeForOrder = (
  quantity: number,
  price: number,
  orderType: string
): number => {
  const isMaker = orderType === 'LIMIT';
  return calculateTradeFee(quantity, price, isMaker);
};
