import { calculateStopLoss, calculateTakeProfit, roundQuantity, roundPrice, parseFilters } from '../src/utils/quantityCalculator';
import { calculatePnl, calculatePnlPercentage, calculateFee, kellyCriterion, calculateSharpeRatio, calculateMaxDrawdown } from '../src/utils/mathHelpers';
import { formatPrice, formatCurrency, formatPercentage, formatPairName } from '../src/utils/priceFormatter';

describe('Trading Engine Utilities', () => {
  test('calculateStopLoss for BUY', () => {
    const sl = calculateStopLoss(50000, 500, 1, 2);
    expect(sl).toBe(49000);
  });

  test('calculateStopLoss for SELL', () => {
    const sl = calculateStopLoss(50000, 500, 1, 2);
    expect(sl).toBeLessThan(50000);
  });

  test('calculateTakeProfit for BUY', () => {
    const tp = calculateTakeProfit(50000, 49000, 'BUY', 2);
    expect(tp).toBe(52000);
  });

  test('roundQuantity with stepSize', () => {
    expect(roundQuantity(1.234567, 0.001)).toBeCloseTo(1.234, 2);
    expect(roundQuantity(10.999, 0.01)).toBeCloseTo(10.99, 2);
  });

  test('roundPrice with tickSize', () => {
    expect(roundPrice(50123.456, 0.01)).toBeCloseTo(50123.45, 1);
  });

  test('calculatePnl for BUY', () => {
    const pnl = calculatePnl(100, 110, 1, 'BUY');
    expect(pnl).toBe(10);
  });

  test('calculatePnl for SELL', () => {
    const pnl = calculatePnl(100, 90, 1, 'SELL');
    expect(pnl).toBe(10);
  });

  test('calculatePnlPercentage', () => {
    const pct = calculatePnlPercentage(100, 110, 'BUY');
    expect(pct).toBeCloseTo(10, 0);
  });

  test('calculateFee', () => {
    const fee = calculateFee(1, 50000, 0.001);
    expect(fee).toBe(50);
  });

  test('kellyCriterion', () => {
    const kelly = kellyCriterion(0.6, 100, 80);
    expect(kelly).toBeGreaterThan(0);
    expect(kelly).toBeLessThanOrEqual(0.25);
  });

  test('calculateSharpeRatio', () => {
    const returns = [0.01, 0.02, -0.01, 0.03, -0.02, 0.01];
    const sharpe = calculateSharpeRatio(returns);
    expect(typeof sharpe).toBe('number');
  });

  test('calculateMaxDrawdown', () => {
    const curve = [100, 110, 105, 95, 100, 90, 95];
    const dd = calculateMaxDrawdown(curve);
    expect(dd).toBeGreaterThan(0);
    expect(dd).toBeLessThan(1);
  });

  test('formatPrice', () => {
    expect(formatPrice(50000.12)).toBe('50000.12');
    expect(formatPrice(0.001234)).toBe('0.001234');
  });

  test('formatCurrency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(1234567)).toBe('$1.23M');
  });

  test('formatPercentage', () => {
    expect(formatPercentage(5.123)).toBe('+5.12%');
    expect(formatPercentage(-3.456)).toBe('-3.46%');
  });

  test('formatPairName', () => {
    expect(formatPairName('BTCUSDT')).toBe('BTC/USDT');
    expect(formatPairName('ETHBTC')).toBe('ETH/BTC');
  });
});
