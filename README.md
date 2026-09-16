# 🤖 AI Trading Bot (Android)

A complete **React Native (Expo)** Android app that connects to the **Binance API** for live
cryptocurrency trading, powered by an on-device **AI signal engine** (7 scored factors,
10 technical indicators, 5-timeframe confluence) with a full risk-management layer.

> ⚠️ **Disclaimer** — trading cryptocurrency is highly volatile and can lose money. This app is
> educational software, not financial advice. It defaults to **Binance Testnet**: start there,
> use small sizes, and never trade money you cannot afford to lose.

## 📱 Download the APK

After the workflow lands on `main` (or a manual *Actions → Build Trading Bot APK → Run workflow*
with “publish” ticked), the rolling release always holds the newest build:

```
https://github.com/Rusindu12/Rs/releases/download/trading-bot-apk/AI-Trading-Bot.apk
```

Open it on your phone → allow “install from unknown sources” → done. Debug-signed, Android 7.0+.
The pipeline runs **typecheck + 65 unit tests before every build**, so a green build means a
verified engine.

## Features

### 1 · Authentication & setup
- Binance **API key + secret** setup screen with format validation and a **connection status dot**
- **Testnet ⇄ Live** toggle with an explicit red confirmation dialog for live trading
- Credentials encrypted **on-device with AES-256-GCM**; the 256-bit master key lives in
  **Android Keystore** (via `expo-secure-store`) — plaintext never touches disk
- **Biometric lock** (fingerprint / face) with auto re-lock on backgrounding
- REST reachability + websocket status indicators, live/testnet badges everywhere

### 2 · Dashboard
- Live portfolio value (USDT / BTC / ETH pills) from account balances marked to market
- **P/L grid — daily / weekly / monthly / all-time** (realized + unrealized)
- Active trades counter, engine tick status
- **Top-10 price ticker** with SVG sparklines (`!miniTicker` websocket)
- **AI confidence gauge** (0–100 %) and **market sentiment** (Bullish / Bearish / Neutral)
- Quick actions: **Start Bot · Stop Bot · 🚨 Emergency Stop** (flattens everything + cancels orders)

### 3 · AI trading engine
Indicators computed in real time on every cycle, per symbol, per timeframe:

| Indicator | Parameters | Role |
|---|---|---|
| RSI | 14 (Wilder) | scored factor (±20) |
| MACD | 12 / 26 / 9 | scored factor (±15) |
| Bollinger Bands | 20, 2σ | scored factor (±15) |
| EMA stack | 9 / 21 / 50 / 200 | scored factor (±20) |
| Volume confirmation | 20-avg, ×1.5 | scored factor (±10, trend-directional) |
| Stochastic | 14 / 3 / 3 | scored factor (±10) |
| **Multi-timeframe confluence** | 1m · 5m · 15m · 1h · 4h | scored factor (±15, capped mean) |
| ATR | 14 (Wilder) | volatility context |
| VWAP | rolling (HLCV) | context |
| Ichimoku Cloud | 9 / 26 / 52, ±26 displacement | context |
| Fibonacci retracement | swing high/low, 7 levels | context |
| Volume Profile | 24 bins, POC + 70 % value area | context |

Signal thresholds (exactly as designed):

```
score ≥ +60 → STRONG_BUY      score ≤ −60 → STRONG_SELL
score ≥ +30 → BUY             score ≤ −30 → SELL
otherwise   → HOLD            confidence = min(100, |score|)
```

Every signal card can be expanded into a **full breakdown**: each factor, its value and its exact
point contribution, plus per-timeframe scores.

### 4 · Live trading engine & risk management
- **Paper mode** (default): simulated fills at live prices with 0.1 % taker fee and a local ledger
- **Live mode**: real Binance spot **market orders** (HMAC-SHA256 signed, `recvWindow`, drift-synced timestamps)
- Position sizing, **max-open-trades cap**, per-symbol one-position rule
- **Stop-loss / take-profit** exits (configurable %) evaluated on every cycle
- **Daily-loss circuit breaker** pauses new entries after repeated losses
- Exits on **SL / TP / opposite signal / emergency stop**; every trade journaled with its reason
- Positions, trades and equity survive app restarts (AsyncStorage)

## Project structure

```
trading-bot/
├── App.tsx                        # boot → lock → setup → tabs
├── app.json                       # Expo config (package com.rusindu.tradingbot)
├── index.ts                       # entry + crypto.getRandomValues polyfill
├── android/                       # committed native project (expo prebuild output)
└── src/
    ├── config.ts                  # endpoints, timeframes, defaults, storage keys
    ├── theme.ts                   # Binance-style dark theme
    ├── indicators/indicators.ts   # RSI MACD BB EMA Stoch ATR VWAP Ichimoku Fib VP (pure TS)
    ├── engine/
    │   ├── signalEngine.ts        # generate_signal — 7-factor scoring + context
    │   ├── riskManager.ts         # sizing, caps, circuit breaker, SL/TP checks
    │   ├── tradingBot.ts          # BotEngine — tick loop, positions, journal, buckets
    │   ├── providers.ts           # PaperProvider / LiveProvider (market orders)
    │   └── runtime.ts             # composition root (REST + WS + stores + engine)
    ├── services/
    │   ├── binance/rest.ts        # signed REST client (klines, account, orders)
    │   ├── binance/ws.ts          # all-market mini-ticker stream + reconnect/watchdog
    │   └── secureVault.ts         # AES-256-GCM credentials + Android Keystore
    ├── crypto/primitives.ts       # HMAC-SHA256, AES-256-GCM, base64 (pure JS, Hermes-safe)
    ├── store/                     # zustand stores (auth / market / bot)
    ├── components/                # UI kit, sparklines, confidence gauge
    ├── screens/                   # Setup · Lock · Dashboard · Signals · Trades · Settings
    └── navigation/TabNavigator.tsx
```

The engine core is **pure TypeScript with injected ports** (market data, storage, clock,
execution) — that’s why it’s unit-tested without a device:

```
$ npm test        # 65 tests: indicators, signal engine, risk, bot lifecycle, crypto, REST signing
$ npm run typecheck
```

## Build & run

```bash
cd trading-bot
npm install
npm run typecheck && npm test       # verify the engine
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Or open `trading-bot/android` in Android Studio and press **Run**.

## CI: automatic APK on every push

`.github/workflows/apk-trading-bot.yml` (independent of the legacy calculator workflow):

1. `npm run typecheck` + `npm test` — engine must be green,
2. `expo prebuild` + `./gradlew assembleDebug`,
3. uploads the **AI-Trading-Bot-debug-apk** artifact on every run,
4. on `main` (or a `[publish-apk]` commit subject, or a manual run with the checkbox) it replaces
   the asset on the rolling **`trading-bot-apk`** release and prints a QR code in the job summary.

> First time only: merge the PR that adds the workflow to `main` and, if GitHub shows the
> “workflows aren’t run” banner, enable Actions and set **Workflow permissions → Read and write**
> so the release step can publish.

## Getting Binance API keys

1. **Testnet**: <https://testnet.binance.vision> → log in (GitHub account) → *Generate HMAC Keys*.
   Free simulated funds, real market behaviour.
2. **Live**: Binance → Profile → **API Management** → *Create API* → enable
   **Enable Spot & Margin Trading** only. **Never enable withdrawals.** Restrict by IP if possible.
3. Paste both keys into the app, keep the toggle on *Testnet (safe)*, press **Connect & Save**.

## Security model

- Keys are encrypted with AES-256-GCM; the master key is generated on first use and stored in
  Android Keystore–backed storage (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Biometric gate before any trading data is visible; auto re-lock on background.
- The app only calls read + spot-order endpoints. Withdrawals, transfers and listing keys are
  never used — and a withdrawal-enabled key would be rejected at setup (`canTrade` check only
  passes for trading-enabled keys; always keep withdrawals disabled).
- “Erase API keys from this device” wipes the encrypted blob and all local bot data.

---

## 🧮 Legacy project: Rs Calculator

This repository previously shipped a Kotlin/Jetpack-Compose calculator. It is untouched and still
builds via `.github/workflows/apk.yml`
([latest calculator APK](https://github.com/Rusindu12/Rs/releases/download/latest-apk/Rs-Calculator.apk)).
The `app/` directory is the calculator; `trading-bot/` is the AI Trading Bot above.
