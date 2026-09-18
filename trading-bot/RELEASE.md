# Release notes

## v6.7 — Trading while the app is closed (Android background bot)

You no longer need the app open (or the internet permanently on) for the bot to work:

- **Background trading tick (Android)** — a WorkManager job wakes the bot every
  ~15 minutes even when the app is swiped away or the phone rebooted
  (start-on-boot). The engine keeps scanning and opening trades while you are away.
- **Exits are absolute** — every live position's SL/TP lives on Binance's servers
  (OCO, v6.6) and executes 24/7 regardless of app, phone or internet state.
- **Reconnect catch-up summary** — coming back online logs how many positions were
  guarded on Binance while away and instantly reconciles any that sold server-side
  (shown in the Activity feed as "sold by Binance while offline").
- **Dashboard protection line** — live mode shows "🛡 n/m position(s) protected on
  Binance's servers" right under the controls.

Reality check (unchanged): NEW buys need internet + the background job cadence is
Android-controlled (≥15 min). Guaranteed-24/7 exits + periodic background scanning +
offline demo trading cover the "I am often offline" case as tightly as mobile
platforms physically allow.

## v6.6 — Real trading while offline: Binance server-side SL/TP (OCO)

The honest physics: an app cannot SEND orders to Binance without internet — no app can.
What CAN trade while you are offline is Binance itself. So now:

- **Every live position gets a real OCO order on Binance** (take-profit limit leg +
  stop-loss stop-limit leg). The order lives on Binance's servers — it executes even
  when the app is closed, the phone is off, or the internet is down for hours.
- **Automatic reconciliation**: on app start and on every reconnect the bot checks the
  server — if an OCO already fired while away, the local position is closed and booked
  as 🛰️ "sold by Binance while offline" in the Activity feed.
- **Clean un-winding**: before any app-driven sell, the OCO is cancelled first so the
  funds are free; if it already filled, the local position syncs instead of re-selling.
- Settings → Bot → "Binance server-side SL/TP (offline protection)" (default ON).
- New unit tests cover the OCO request builder and Binance price rounding (99 total).

Demo/paper mode keeps its offline simulated-price trading from v6.5.

## v6.5 — Offline resilience: demo trading keeps running without internet

- **Demo mode works fully offline** — when the connection drops, paper trading
  continues on a mean-reverting simulated price walk (bounded ±12% of the last
  real price, clearly labelled "SIMULATED PRICES"). Real prices snap back the
  moment the internet returns.
- **Keyed (live/testnet) mode pauses safely offline** — real orders cannot be
  sent without internet; the bot waits and RESUMES AUTOMATICALLY on reconnect
  with an immediate catch-up tick. Open-position protection note shown.
- **Offline banners**: blue for demo (trading continues, simulated), red for
  keyed (paused, resumes automatically) on the Dashboard; the 💹 Activity feed
  shows a "SIMULATED PRICES" badge while simulating.
- **Tick hardening**: a failed order no longer kills the scan cycle; WS status
  changes trigger immediate catch-up ticks.
- Honest physics: real-money trading always requires internet — orders must
  reach Binance. Offline mode is for demo/paper trading and safe pausing.

Note: real trading offline is impossible by definition (orders need the internet).
What we fixed: everything that CAN work offline now does, and nothing breaks.

## v6.4.1 — SELL-side overhaul: "does it only HOLD? doesn't it sell?"

- **Two new exit paths so every BUY eventually becomes a SELL**:
  - 🔄 **SIGNAL_FLIP** — the position is sold as soon as the AI score flips to
    ≤ −20 (bearish turn), instead of waiting for a rare full SELL signal (≤ −30).
  - ⏱ **MAX_HOLD time stop** (Settings → "Close trades after (hours)", default 8) —
    a position held too long is closed at market. 0 disables it.
- Exit reasons now show in the 💹 Activity feed in plain language:
  🎯 take-profit hit · 🛑 stop-loss hit · 🔄 AI turned bearish · ⏱ max hold · 🔻 sell signal.
- Exit priority: SL → TP → sell signal → AI flip → time stop (SL/TP always first).
- Unit-tested: 3 new tests cover flip, time-stop and SL/TP priority (94 total).

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
