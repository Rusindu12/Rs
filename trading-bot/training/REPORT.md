# AI Training Report

- **Data:** synthetic (offline fallback) · 6 symbols × 1400 bars × 5 timeframes
- **Walk-forward:** train 979 bars → test 421 bars (never optimized on test)
- **Configs evaluated:** 400 · in 19.4s
- **Decision:** adopted trained weights

## Test-segment performance (out-of-sample)

| Metric | Spec defaults | Trained AI |
|---|---|---|
| Decision accuracy (BUY/HOLD/SELL) | 62.7% | **67.6%** |
| — BUY signals correct | 62.7% (37/59) | **73.8% (59/80)** |
| — SELL signals correct | 68.3% (41/60) | **72.5% (66/91)** |
| — HOLD signals correct | 61.6% (181/294) | **63.6% (154/242)** |
| Trades | 6 | 8 |
| Stop-loss / Take-profit | 2% / 4% | **1.1% / 1.4%** |
| Win rate | 34.74% | **43.94%** |
| Return | -0.84% | **1.82%** |
| Profit factor | 1.23 | **2.10** |
| Max drawdown | 2.93% | 1.78% |

## Trained parameters

```json
{
  "factorScale": {
    "RSI": 0.5,
    "MACD": 1.324442058801651,
    "BBands": 0.885257363319397,
    "EMA": 1.2114861054574027,
    "Volume": 0.8251818721656426,
    "Stoch": 0.9586049795150757,
    "Multi-TF": 0.5,
    "Pattern": 0.5,
    "Regime": 1.4260609315574169,
    "Divergence": 1,
    "S/R Zones": 1
  },
  "thresholds": {
    "rsiOversold": 33.5,
    "rsiOverbought": 72.3,
    "volumeSpike": 2
  },
  "regimeGate": true,
  "mtfWeights": {
    "1m": 0.8316598253503442,
    "5m": 0.5156697005033493,
    "15m": 1.2256197874426171,
    "1h": 1.5407442212104798,
    "4h": 1.1009916996955873
  },
  "risk": {
    "stopLossPct": 1.1,
    "takeProfitPct": 1.4
  }
}
```
