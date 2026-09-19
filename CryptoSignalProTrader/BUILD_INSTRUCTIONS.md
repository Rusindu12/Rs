# CryptoSignal AI Pro Trader - Build Instructions

## Prerequisites

- Node.js 18+ and npm
- Java JDK 17
- Android Studio (for Android SDK)
- EAS CLI (`npm install -g eas-cli`)
- Expo CLI (`npm install -g expo-cli`)

## Quick Start

### 1. Install Dependencies

```bash
cd CryptoSignalProTrader
npm install
```

### 2. Configure EAS (one-time setup)

```bash
eas login
eas build:configure
```

### 3. Prebuild Android Project

```bash
npx expo prebuild --platform android
```

### 4. Build APK (Production)

```bash
# Using EAS Build (cloud - recommended)
eas build -p android --profile production

# Or local build (requires Android SDK)
cd android && ./gradlew assembleRelease
```

### 5. Install APK

```bash
# From EAS build - download the APK from the build URL
# From local build:
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Development

```bash
# Start development server
npx expo start

# Run on Android emulator
npx expo start --android

# Run tests
npm test
```

## Environment Setup

### Binance Testnet (Recommended for first use)

1. Go to https://testnet.binance.vision/
2. Create a testnet account
3. Generate API key and secret
4. Enable "Testnet Mode" in the app

### Binance Mainnet (Live Trading)

1. Go to https://www.binance.com/
2. Create API key with **Spot Trading** permission only
3. **DO NOT** enable Withdraw permission
4. Enter credentials in the app

## Key Features

### Background Trading (24/7)
- Foreground service keeps trading alive when app is minimized
- Auto-restarts on phone boot
- Wake lock prevents CPU sleep
- WebSocket auto-reconnect with exponential backoff

### Paper Trading (Default)
- Uses real market data
- Virtual portfolio tracking
- No real money at risk
- Switch to live trading in Bot Settings

### Risk Management
- Max 3% portfolio per trade (configurable)
- Daily loss circuit breaker: 5%
- Max drawdown protection: 15%
- Correlation checks
- Flash crash protection

## Project Structure (106 files)

```
CryptoSignalProTrader/
├── App.tsx                    # Root component
├── app.json, package.json     # Config files
├── android/                   # Native Android code
│   └── TradingForegroundService.java
│   └── BootReceiver.java
├── src/
│   ├── api/                   # Binance REST + WebSocket
│   ├── engine/                # Trading engine + 10 indicators
│   ├── background/            # Background service
│   ├── screens/               # 14 screens
│   ├── components/            # UI components
│   ├── store/                 # Redux state
│   ├── services/              # DB, notifications, encryption
│   ├── hooks/                 # Custom React hooks
│   ├── theme/                 # Colors, typography, spacing
│   ├── types/                 # TypeScript definitions
│   └── utils/                 # Math, formatting, validation
└── __tests__/                 # Unit tests
```

## Technical Indicators (All implemented from scratch)

1. **RSI** - Wilder's smoothing, divergence detection
2. **MACD** - EMA-based, crossovers, histogram
3. **Bollinger Bands** - Squeeze detection, %B
4. **EMA Crossover** - Triple EMA (9/21/50)
5. **Stochastic RSI** - K/D crossovers
6. **Volume Analysis** - VWAP, OBV, spike detection
7. **Support & Resistance** - Pivot points, Fibonacci
8. **Candlestick Patterns** - 11 patterns detected
9. **ATR** - Dynamic stop-loss calculation
10. **ADX** - Trend strength measurement

## Signal Scoring

- Each indicator: -100 to +100
- Weighted composite score
- Multi-timeframe confirmation
- Market regime detection (Bull/Bear/Sideways/Volatile)
