# Release notes

## v6.1 — AI v3.1: the AI now trades what it trains

- **Risk is trained**: stop-loss / take-profit levels are optimised by the same
  walk-forward process as signal weights and ship inside `trainedWeights.json`
  (`risk.stopLossPct` / `risk.takeProfitPct`). The bot's ATR-aware stop engine
  seeds from these trained levels on every entry.
- **Deeper history**: CI training now pulls 4 months of real Binance klines per
  symbol from the data.binance.vision archives (REST fallback), 2,800 primary
  bars per symbol, all 5 timeframes.
- **Smarter search**: multi-restart hill-climb keeps the top-3 random-search
  seeds and refines each; CI budget raised to 500 evaluated configs.
- **Parity fix**: the app's Multi-TF confluence now uses the trained RSI
  thresholds (identical math to the backtester — factor-by-factor unit-tested).
