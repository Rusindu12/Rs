/**
 * train.ts — orchestrates: load data (live Binance or synthetic) →
 * walk-forward optimization per the global watchlist → write
 * src/engine/trainedWeights.json + training/REPORT.md.
 *
 *   npx tsx training/train.ts [--synthetic] [--evals=300] [--symbols=BTCUSDT,ETHUSDT]
 *
 * CI runs this on every build so the shipped app carries weights freshly
 * trained on real Binance history.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrainingSet, DEFAULT_SYMBOLS } from './data';
import { prepare, BASE_CONFIG, DEFAULT_BT, type Metrics } from './backtest';
import { optimize } from './optimize';
import type { TrainableConfig } from './backtest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const SYNTHETIC = args.includes('--synthetic');
const evalArg = args.find((a) => a.startsWith('--evals='));
const EVALS = evalArg ? Number(evalArg.split('=')[1]) : 320;
const symArg = args.find((a) => a.startsWith('--symbols='));
const SYMBOLS = symArg ? symArg.split('=')[1].split(',') : DEFAULT_SYMBOLS.slice(0, 6);
const BARS = 1400;

function pct(v: number) {
  return `${v >= 0 ? '' : ''}${v.toFixed(2)}%`;
}
function accPct(n: number, correct: number) {
  return n > 0 ? `${((correct / n) * 100).toFixed(1)}% (${correct}/${n})` : '—';
}

async function main() {
  const t0 = Date.now();
  console.log(`AI training — symbols: ${SYMBOLS.join(', ')} | evals: ${EVALS} | bars: ${BARS}`);
  const { sets, live } = await loadTrainingSet(SYMBOLS, BARS, SYNTHETIC ? 'synthetic' : 'live');
  console.log(`data: ${live ? 'LIVE Binance' : 'synthetic fallback'} (${sets.length} symbols)`);

  const preps = sets.map(prepare);

  // walk-forward split: 70 % train / 30 % test on the primary series
  const n = Math.min(...preps.map((p) => p.primary.close.length));
  const split = Math.floor(n * 0.7);
  const trainSeg = { from: 0, to: split };
  const testSeg = { from: split, to: n };

  const { chosen, best, defaultResult, evalsRun } = optimize(preps, trainSeg, testSeg, {
    evals: EVALS,
    seed: 20260917,
  });

  const improved = best.testFit > defaultResult.testFit;
  console.log(`\nresult: ${chosen === BASE_CONFIG ? 'kept SPEC defaults (trained config did not beat them out-of-sample)' : 'ADOPTED trained config'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const performance = {
    trainFit: r2(best.trainFit),
    testFit: r2(best.testFit),
    defaultTestFit: r2(defaultResult.testFit),
    adopted: improved,
    ...metricsJson(best.test),
  };

  const weights = {
    version: 3,
    trainedAt: new Date().toISOString(),
    dataSource: live ? 'binance-live' : 'synthetic',
    symbols: SYMBOLS,
    barsTested: n,
    evals: evalsRun,
    walkForward: { trainBars: split, testBars: n - split },
    factorScale: chosen.factorScale,
    thresholds: {
      rsiOversold: chosen.rsiOversold,
      rsiOverbought: chosen.rsiOverbought,
      volumeSpike: chosen.volumeSpike,
    },
    regimeGate: chosen.regimeGate,
    mtfWeights: chosen.mtfMult,
    risk: { stopLossPct: chosen.slPct, takeProfitPct: chosen.tpPct },
    performance,
  };

  const outPath = join(root, 'src', 'engine', 'trainedWeights.json');
  writeFileSync(outPath, JSON.stringify(weights, null, 2) + '\n');
  console.log(`wrote ${outPath}`);

  const report = `# AI Training Report

- **Data:** ${live ? 'live Binance klines' : 'synthetic (offline fallback)'} · ${SYMBOLS.length} symbols × ${BARS} bars × 5 timeframes
- **Walk-forward:** train ${split} bars → test ${n - split} bars (never optimized on test)
- **Configs evaluated:** ${evalsRun} · in ${((Date.now() - t0) / 1000).toFixed(1)}s
- **Decision:** ${chosen === BASE_CONFIG ? 'kept spec defaults (out-of-sample guard)' : 'adopted trained weights'}

## Test-segment performance (out-of-sample)

| Metric | Spec defaults | Trained AI |
|---|---|---|
| Decision accuracy (BUY/HOLD/SELL) | ${defaultResult.test.classAcc.toFixed(1)}% | **${best.test.classAcc.toFixed(1)}%** |
| — BUY signals correct | ${accPct(defaultResult.test.acc.buy.n, defaultResult.test.acc.buy.correct)} | **${accPct(best.test.acc.buy.n, best.test.acc.buy.correct)}** |
| — SELL signals correct | ${accPct(defaultResult.test.acc.sell.n, defaultResult.test.acc.sell.correct)} | **${accPct(best.test.acc.sell.n, best.test.acc.sell.correct)}** |
| — HOLD signals correct | ${accPct(defaultResult.test.acc.hold.n, defaultResult.test.acc.hold.correct)} | **${accPct(best.test.acc.hold.n, best.test.acc.hold.correct)}** |
| Trades | ${defaultResult.test.trades} | ${best.test.trades} |
| Stop-loss / Take-profit | 2% / 4% | **${chosen.slPct}% / ${chosen.tpPct}%** |
| Win rate | ${pct(defaultResult.test.winRate)} | **${pct(best.test.winRate)}** |
| Return | ${pct(defaultResult.test.returnPct)} | **${pct(best.test.returnPct)}** |
| Profit factor | ${defaultResult.test.profitFactor.toFixed(2)} | **${best.test.profitFactor.toFixed(2)}** |
| Max drawdown | ${pct(defaultResult.test.maxDrawdownPct)} | ${pct(best.test.maxDrawdownPct)} |

## Trained parameters

\`\`\`json
${JSON.stringify({ factorScale: chosen.factorScale, thresholds: weights.thresholds, regimeGate: chosen.regimeGate, mtfWeights: chosen.mtfMult, risk: weights.risk }, null, 2)}
\`\`\`
`;
  writeFileSync(join(root, 'training', 'REPORT.md'), report);
  console.log('wrote training/REPORT.md');
  console.log(report);
}

function metricsJson(m: Metrics) {
  return {
    winRate: r2(m.winRate),
    returnPct: r2(m.returnPct),
    profitFactor: r2(m.profitFactor),
    maxDrawdownPct: r2(m.maxDrawdownPct),
    classAcc: r2(m.classAcc),
    decisions: {
      buy: { ...m.acc.buy, accuracy: m.acc.buy.n ? r2((m.acc.buy.correct / m.acc.buy.n) * 100) : null },
      sell: { ...m.acc.sell, accuracy: m.acc.sell.n ? r2((m.acc.sell.correct / m.acc.sell.n) * 100) : null },
      hold: { ...m.acc.hold, accuracy: m.acc.hold.n ? r2((m.acc.hold.correct / m.acc.hold.n) * 100) : null },
    },
  };
}
const r2 = (v: number) => Math.round(v * 100) / 100;

main().catch((e) => {
  console.error('training failed:', e);
  process.exit(1);
});
