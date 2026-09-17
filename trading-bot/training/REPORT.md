# AI Training Report

- **Data:** synthetic (offline fallback) · 6 symbols × 1000 bars × 5 timeframes
- **Walk-forward:** train 700 bars → test 300 bars (never optimized on test)
- **Configs evaluated:** 200 · in 6.4s
- **Decision:** adopted trained weights

## Test-segment performance (out-of-sample)

| Metric | Spec defaults | Trained AI |
|---|---|---|
| Decision accuracy (BUY/HOLD/SELL) | 62.3% | **66.1%** |
| — BUY signals correct | 56.7% (17/30) | **72.7% (40/55)** |
| — SELL signals correct | 72.6% (45/62) | **72.4% (63/87)** |
| — HOLD signals correct | 60.0% (120/200) | **60.0% (90/150)** |
| Trades | 4 | 5 |
| Win rate | 39.17% | **46.39%** |
| Return | -0.10% | **1.33%** |
| Profit factor | 2.03 | **4.06** |
| Max drawdown | 2.19% | 2.19% |

## Trained parameters

```json
{
  "factorScale": {
    "RSI": 0.894379180483986,
    "MACD": 1.1790640354156494,
    "BBands": 0.5139563584950566,
    "EMA": 1.4955644726753234,
    "Volume": 1.2738601446095292,
    "Stoch": 1.2071514671733004,
    "Multi-TF": 0.9604555106163025,
    "Pattern": 1.027348027231319,
    "Regime": 1.245183861857406,
    "Divergence": 1,
    "S/R Zones": 1
  },
  "thresholds": {
    "rsiOversold": 29.4,
    "rsiOverbought": 73.6,
    "volumeSpike": 1.4
  },
  "regimeGate": true,
  "mtfWeights": {
    "1m": 1.4537902430957184,
    "5m": 0.6738259081790297,
    "15m": 0.8878512829542161,
    "1h": 0.6163037180900574,
    "4h": 0.7625669211149215
  }
}
```
