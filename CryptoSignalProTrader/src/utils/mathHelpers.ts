import Big from 'big.js';

Big.DP = 20;
Big.RM = Big.roundHalfEven;

export const bigAdd = (a: number | string, b: number | string): number => {
  return new Big(a).plus(b).toNumber();
};

export const bigSub = (a: number | string, b: number | string): number => {
  return new Big(a).minus(b).toNumber();
};

export const bigMul = (a: number | string, b: number | string): number => {
  return new Big(a).times(b).toNumber();
};

export const bigDiv = (a: number | string, b: number | string): number => {
  return new Big(a).div(b).toNumber();
};

export const bigMin = (...values: (number | string)[]): number => {
  if (values.length === 0) return 0;
  let min = new Big(values[0]);
  for (let i = 1; i < values.length; i++) {
    const current = new Big(values[i]);
    if (current.lt(min)) min = current;
  }
  return min.toNumber();
};

export const bigMax = (...values: (number | string)[]): number => {
  if (values.length === 0) return 0;
  let max = new Big(values[0]);
  for (let i = 1; i < values.length; i++) {
    const current = new Big(values[i]);
    if (current.gt(max)) max = current;
  }
  return max.toNumber();
};

export const roundToStep = (value: number, stepSize: number): number => {
  if (stepSize <= 0) return value;
  const step = new Big(stepSize);
  const val = new Big(value);
  const precision = getDecimalPlaces(stepSize);
  return parseFloat(val.div(step).round(0, Big.roundDown).times(step).toFixed(precision));
};

export const roundToTickSize = (value: number, tickSize: number): number => {
  if (tickSize <= 0) return value;
  const precision = getDecimalPlaces(tickSize);
  return parseFloat(new Big(value).toFixed(precision));
};

export const getDecimalPlaces = (value: number): number => {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) return 0;
  return str.length - decimalIndex - 1;
};

export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return bigMul(bigDiv(part, total), 100);
};

export const calculatePnl = (
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'BUY' | 'SELL'
): number => {
  if (side === 'BUY') {
    return bigMul(bigSub(exitPrice, entryPrice), quantity);
  }
  return bigMul(bigSub(entryPrice, exitPrice), quantity);
};

export const calculatePnlPercentage = (
  entryPrice: number,
  exitPrice: number,
  side: 'BUY' | 'SELL'
): number => {
  if (side === 'BUY') {
    return bigMul(bigDiv(bigSub(exitPrice, entryPrice), entryPrice), 100);
  }
  return bigMul(bigDiv(bigSub(entryPrice, exitPrice), entryPrice), 100);
};

export const calculateFee = (quantity: number, price: number, feeRate: number): number => {
  return bigMul(bigMul(quantity, price), feeRate);
};

export const kellyCriterion = (winRate: number, avgWin: number, avgLoss: number): number => {
  if (avgLoss === 0 || winRate <= 0 || winRate >= 1) return 0;
  const winLossRatio = bigDiv(avgWin, avgLoss);
  const kelly = bigSub(bigMul(winRate, winLossRatio), bigSub(1, winRate));
  return Math.max(0, Math.min(kelly, 0.25));
};

export const calculateSharpeRatio = (returns: number[], riskFreeRate: number = 0): number => {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (mean - riskFreeRate) / stdDev;
};

export const calculateSortinoRatio = (returns: number[], riskFreeRate: number = 0): number => {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const downsideReturns = returns.filter(r => r < 0);
  if (downsideReturns.length === 0) return mean > riskFreeRate ? Infinity : 0;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return 0;
  return (mean - riskFreeRate) / downsideDev;
};

export const calculateMaxDrawdown = (equityCurve: number[]): number => {
  if (equityCurve.length < 2) return 0;
  let maxDrawdown = 0;
  let peak = equityCurve[0];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) peak = equityCurve[i];
    const drawdown = bigDiv(bigSub(peak, equityCurve[i]), peak);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
};

export const calculateProfitFactor = (wins: number[], losses: number[]): number => {
  const totalWins = wins.reduce((sum, w) => sum + w, 0);
  const totalLosses = Math.abs(losses.reduce((sum, l) => sum + l, 0));
  if (totalLosses === 0) return totalWins > 0 ? Infinity : 0;
  return bigDiv(totalWins, totalLosses);
};

export const calculateCAGR = (
  startValue: number,
  endValue: number,
  years: number
): number => {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return 0;
  return Math.pow(bigDiv(endValue, startValue), bigDiv(1, years)) - 1;
};

export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

export const calculateCorrelation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let covXY = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return 0;
  return covXY / denom;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  return bigDiv(bigSub(value, min), bigSub(max, min));
};

export const weightedAverage = (values: number[], weights: number[]): number => {
  if (values.length !== weights.length || values.length === 0) return 0;
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    sum = bigAdd(sum, bigMul(values[i], weights[i]));
    weightSum = bigAdd(weightSum, weights[i]);
  }
  if (weightSum === 0) return 0;
  return bigDiv(sum, weightSum);
};
