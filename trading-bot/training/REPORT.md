# AI Training Report

- **Data:** synthetic (offline fallback) · 6 symbols × 1000 bars × 5 timeframes
- **Walk-forward:** train 700 bars → test 300 bars (never optimized on test)
- **Configs evaluated:** 40 · in 1.5s
- **Decision:** adopted trained weights

## Test-segment performance (out-of-sample)

| Metric | Spec defaults | Trained AI |
|---|---|---|
| Decision accuracy (BUY/HOLD/SELL) | 62.1% | **64.4%** |
| — BUY signals correct | 56.7% (17/30) | **70.2% (33/47)** |
| — SELL signals correct | 73.0% (46/63) | **69.5% (66/95)** |
| — HOLD signals correct | 59.5% (119/200) | **59.3% (89/150)** |
| Trades | 4 | 5 |
| Win rate | 45.83% | **42.50%** |
| Return | 0.03% | **0.65%** |
| Profit factor | 2.40 | **6.22** |
| Max drawdown | 2.11% | 2.43% |

## Trained parameters

```json
{
  "factorScale": {
    "RSI": 0.9407184495404363,
    "MACD": 1.1981706619262695,
    "BBands": 0.7508703947067261,
    "EMA": 1.487654095888138,
    "Volume": 0.7173981666564941,
    "Stoch": 0.6404977142810822,
    "Multi-TF": 1.096834123134613,
    "Pattern": 1.5,
    "Regime": 0.5127623081207275,
    "Divergence": 1,
    "S/R Zones": 1
  },
  "thresholds": {
    "rsiOversold": 26,
    "rsiOverbought": 68.6,
    "volumeSpike": 1.2
  },
  "regimeGate": true,
  "mtfWeights": {
    "1m": 1.0823533415794373,
    "5m": 0.5217185735702514,
    "15m": 0.5,
    "1h": 0.5157883405685425,
    "4h": 0.5
  }
}
```
