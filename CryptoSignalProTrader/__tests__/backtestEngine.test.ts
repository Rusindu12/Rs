import { runMonteCarloSimulation } from '../src/engine/backtestEngine';
import { BacktestTrade } from '../src/types/app';

describe('Backtest Engine', () => {
  test('runMonteCarloSimulation should return percentiles', () => {
    const trades: BacktestTrade[] = [];
    for (let i = 0; i < 100; i++) {
      trades.push({
        symbol: 'BTCUSDT', side: 'BUY', entryPrice: 50000, exitPrice: 50000 + (Math.random() - 0.45) * 1000,
        quantity: 0.01, pnl: (Math.random() - 0.45) * 10, pnlPercent: (Math.random() - 0.45) * 2,
        entryTime: '2024-01-01', exitTime: '2024-01-02', duration: 86400000, signalType: 'BUY',
      });
    }

    const result = runMonteCarloSimulation(trades, 10000, 500);
    expect(result.percentile5).toBeDefined();
    expect(result.percentile25).toBeDefined();
    expect(result.median).toBeDefined();
    expect(result.percentile75).toBeDefined();
    expect(result.percentile95).toBeDefined();
    expect(result.percentile5).toBeLessThan(result.median);
    expect(result.median).toBeLessThan(result.percentile95);
  });

  test('runMonteCarloSimulation with empty trades', () => {
    const result = runMonteCarloSimulation([], 10000);
    expect(result.median).toBe(10000);
  });
});
