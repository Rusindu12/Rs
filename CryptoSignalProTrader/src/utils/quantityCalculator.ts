import Big from 'big.js';
import { roundToStep } from './mathHelpers';
import { BinanceSymbolInfo, BinanceFilter } from '../types/binance';

export const calculateOrderQuantity = (
  balance: number,
  price: number,
  percentage: number,
  symbolInfo: BinanceSymbolInfo
): number => {
  const allocation = new Big(balance).times(percentage).div(100);
  const rawQuantity = allocation.div(price).toNumber();
  const filters = parseFilters(symbolInfo.filters);
  return roundQuantity(rawQuantity, filters.lotSize.stepSize);
};

export const calculateOrderValue = (quantity: number, price: number): number => {
  return new Big(quantity).times(price).toNumber();
};

export const roundQuantity = (quantity: number, stepSize: number): number => {
  return roundToStep(quantity, stepSize);
};

export const roundPrice = (price: number, tickSize: number): number => {
  return roundToStep(price, tickSize);
};

export const validateOrderQuantity = (
  quantity: number,
  price: number,
  symbolInfo: BinanceSymbolInfo
): { valid: boolean; error: string } => {
  const filters = parseFilters(symbolInfo.filters);

  if (quantity < filters.lotSize.minQty) {
    return {
      valid: false,
      error: `Quantity ${quantity} below minimum ${filters.lotSize.minQty}`,
    };
  }

  if (filters.lotSize.maxQty > 0 && quantity > filters.lotSize.maxQty) {
    return {
      valid: false,
      error: `Quantity ${quantity} above maximum ${filters.lotSize.maxQty}`,
    };
  }

  const notional = new Big(quantity).times(price).toNumber();
  if (notional < filters.minNotional) {
    return {
      valid: false,
      error: `Order value $${notional.toFixed(2)} below minimum $${filters.minNotional}`,
    };
  }

  if (price < filters.priceFilter.minPrice) {
    return {
      valid: false,
      error: `Price ${price} below minimum ${filters.priceFilter.minPrice}`,
    };
  }

  if (filters.priceFilter.maxPrice > 0 && price > filters.priceFilter.maxPrice) {
    return {
      valid: false,
      error: `Price ${price} above maximum ${filters.priceFilter.maxPrice}`,
    };
  }

  return { valid: true, error: '' };
};

export const calculateMaxQuantity = (
  balance: number,
  price: number,
  symbolInfo: BinanceSymbolInfo
): number => {
  const filters = parseFilters(symbolInfo.filters);
  const rawMax = new Big(balance).div(price).toNumber();
  return roundQuantity(rawMax, filters.lotSize.stepSize);
};

export const calculatePercentQuantity = (
  balance: number,
  price: number,
  percent: number,
  symbolInfo: BinanceSymbolInfo
): number => {
  const filters = parseFilters(symbolInfo.filters);
  const amount = new Big(balance).times(percent).div(100);
  const rawQty = amount.div(price).toNumber();
  return roundQuantity(rawQty, filters.lotSize.stepSize);
};

interface ParsedFilters {
  lotSize: { minQty: number; maxQty: number; stepSize: number };
  priceFilter: { minPrice: number; maxPrice: number; tickSize: number };
  minNotional: number;
  maxOrders: number;
  maxAlgoOrders: number;
}

export const parseFilters = (filters: BinanceFilter[]): ParsedFilters => {
  const result: ParsedFilters = {
    lotSize: { minQty: 0, maxQty: 0, stepSize: 0 },
    priceFilter: { minPrice: 0, maxPrice: 0, tickSize: 0 },
    minNotional: 10,
    maxOrders: 200,
    maxAlgoOrders: 10,
  };

  for (const filter of filters) {
    switch (filter.filterType) {
      case 'LOT_SIZE':
        result.lotSize = {
          minQty: parseFloat(filter.minQty || '0'),
          maxQty: parseFloat(filter.maxQty || '0'),
          stepSize: parseFloat(filter.stepSize || '0'),
        };
        break;
      case 'PRICE_FILTER':
        result.priceFilter = {
          minPrice: parseFloat(filter.minPrice || '0'),
          maxPrice: parseFloat(filter.maxPrice || '0'),
          tickSize: parseFloat(filter.tickSize || '0'),
        };
        break;
      case 'MIN_NOTIONAL':
        result.minNotional = parseFloat(filter.minNotional || '10');
        break;
      case 'MAX_NUM_ORDERS':
        result.maxOrders = filter.maxNumOrders || 200;
        break;
      case 'MAX_NUM_ALGO_ORDERS':
        result.maxAlgoOrders = filter.maxNumAlgoOrders || 10;
        break;
    }
  }

  return result;
};

export const calculateStopLoss = (
  entryPrice: number,
  atr: number,
  side: 'BUY' | 'SELL',
  atrMultiplier: number = 2
): number => {
  const slDistance = new Big(atr).times(atrMultiplier);
  if (side === 'BUY') {
    return new Big(entryPrice).minus(slDistance).toNumber();
  }
  return new Big(entryPrice).plus(slDistance).toNumber();
};

export const calculateTakeProfit = (
  entryPrice: number,
  stopLoss: number,
  side: 'BUY' | 'SELL',
  riskRewardRatio: number = 2
): number => {
  const risk = Math.abs(new Big(entryPrice).minus(stopLoss).toNumber());
  const reward = new Big(risk).times(riskRewardRatio);
  if (side === 'BUY') {
    return new Big(entryPrice).plus(reward).toNumber();
  }
  return new Big(entryPrice).minus(reward).toNumber();
};

export const calculateTrailingStop = (
  currentPrice: number,
  entryPrice: number,
  trailingPercent: number,
  side: 'BUY' | 'SELL'
): { isActive: boolean; stopPrice: number } => {
  const profitPct = side === 'BUY'
    ? new Big(currentPrice).minus(entryPrice).div(entryPrice).times(100).toNumber()
    : new Big(entryPrice).minus(currentPrice).div(entryPrice).times(100).toNumber();

  if (profitPct < trailingPercent) {
    return { isActive: false, stopPrice: 0 };
  }

  const trailAmount = new Big(currentPrice).times(trailingPercent).div(100);
  const stopPrice = side === 'BUY'
    ? new Big(currentPrice).minus(trailAmount).toNumber()
    : new Big(currentPrice).plus(trailAmount).toNumber();

  return { isActive: true, stopPrice };
};
