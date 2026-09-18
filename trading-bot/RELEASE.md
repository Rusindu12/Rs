# Release notes

## v6.4 — 💹 Activity tab: a dedicated live feed of every buy & sell

- New **Activity** tab (💹) — one card per event, newest first:
  - green ▲ **BOUGHT** cards (coin, amount, fill price, signal reason, DEMO tag)
  - red ▼ **SOLD** cards with realised PnL (+$/%), exit reason (TAKE_PROFIT / STOP_LOSS / …)
- 24-hour summary tiles: buys, sells, realised PnL from sold coins.
- All / Buys / Sells filters; LIVE / scanning indicator; relative timestamps
  ("2m ago") that refresh automatically.
- Friendly empty state that explains the bot is scanning and the feed updates
  the moment a coin is bought or sold.

## v6.3.2 — FIX: "the bot never trades" (root cause: it was never started)

- **Demo mode now auto-starts the paper bot** the moment the app opens — no
  hidden Start button required. It trades with $10,000 simulated funds from launch.
- **Heartbeat log** — every scan cycle now writes a one-line summary to the
  engine log: `scanned 6 · best SOLUSDT +41 (BUY) · entry-ready 2 · opened 0 · closed 0`.
  If the app is alive you SEE it working in Trades → Engine log.
- **Dashboard idle banner** — when the bot is not running (keyed live/testnet
  modes) a gold warning explains that trading is OFF and where Start is.
- Turbo trade-frequency floor lowered to score ≥ 8 for more aggressive entry
  counting (measured: ~37% of bars reach it in trending conditions).

## v6.3 — FIX: "no trades happening" — network resilience + trade modes

- **Mirror failover for market data**: REST klines/tickers now rotate through
  api.binance.com → data-api.binance.vision → api-gcp → api1/api2. Home networks
  that block or throttle api.binance.com automatically switch to the official
  public mirror, so candles load and the engine can trade again.
- **WebSocket failover**: live prices fall back to data-stream.binance.vision
  when stream.binance.com cannot connect.
- **Crash fix**: one symbol failing to produce a signal no longer aborts the whole
  bot tick — it is skipped and logged while the other symbols keep trading.
- **Trade frequency setting** (Settings → Bot): Chill (BUY ≥ 30) / Normal (score ≥ 20,
  default) / Turbo (score ≥ 12, trend gate off). Normal opens noticeably more trades
  than the old trained-conservative defaults; Turbo is for choppy experimentation.
- **🩺 Engine diagnostics card** (Settings): shows the market-data host in use,
  cached candle sets, fetch-failure count and the last data error — so "why is it
  not trading" is always visible on-screen.

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

## v6.2.1

- Profile tab polish release (marker commit for CI publish).

- CI: publish decision now scans the last 6 commit subjects, so merges between
  the marker commit and the build no longer skip publishing.
