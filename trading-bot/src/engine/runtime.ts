import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearCredentials,
  loadCredentials,
  loadSecuritySettings,
  saveCredentials,
  saveSecuritySettings,
  type StoredCredentials,
} from '../services/secureVault';
import { BinanceRest } from '../services/binance/rest';
import { MarketStreams, type MiniTicker } from '../services/binance/ws';
import { BotEngine, memoryStorage, type BotLogPort } from './tradingBot';
import { LiveProvider, PaperProvider } from './providers';
import { generateSignal } from './signalEngine';
import type { SymbolMarketData, TradingProvider } from './types';
import {
  DEFAULT_SYMBOLS,
  ENGINE_TIMEFRAMES,
  ENVIRONMENTS,
  KLINE_LIMIT,
  KLINE_TTL_MS,
  STORAGE_KEYS,
  type Environment,
  type Timeframe,
} from '../config';
import { useAuthStore } from '../store/authStore';
import { useBotStore, type LogLine } from '../store/botStore';
import { useMarketStore } from '../store/marketStore';
import type { Candle } from '../indicators/indicators';

/**
 * AppRuntime — the composition root.
 *
 * Wires the pure BotEngine to React-Native infrastructure:
 *   • Binance REST client (signed) + websocket market streams
 *   • paper / live trading providers
 *   • zustand stores + AsyncStorage persistence
 *   • biometric/credential vault
 */
class AppRuntime {
  rest: BinanceRest | null = null;
  paper: PaperProvider | null = null;
  live: LiveProvider | null = null;
  bot: BotEngine | null = null;
  private ws: MarketStreams | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private klineCache = new Map<string, { at: number; candles: Candle[] }>();
  private prices: Record<string, number> = {};
  private paperLedgerKey = '@aitb/paper.ledger.v1';
  private inited = false;

  private storeLogger: BotLogPort = {
    log(level, message) {
      const line: LogLine = { at: Date.now(), level, message };
      useBotStore.getState().pushLog(line);
      console.log(`[aitb][${level}] ${message}`);
    },
  };

  async init(): Promise<void> {
    if (this.inited) return;
    this.inited = true;

    const security = await loadSecuritySettings();
    useAuthStore.getState().setBiometricEnabled(security.biometricEnabled);

    const creds = await loadCredentials();
    useAuthStore.getState().setCredentials(creds);
    useAuthStore.getState().setHydrated(true);

    if (creds) {
      try {
        this.wireCredentials(creds);
      } catch (e) {
        this.storeLogger.log('error', `credential wiring failed: ${String(e)}`);
      }
    }
  }

  /** Build REST / providers / bot around a credential set. */
  private async wireCredentials(creds: StoredCredentials): Promise<void> {
    this.rest = new BinanceRest(creds.apiKey, creds.apiSecret, creds.environment);
    this.live = new LiveProvider(this.rest);

    this.paper = new PaperProvider(10_000, (symbol) => this.prices[symbol] ?? NaN);

    this.bot = new BotEngine({
      provider: this.activeProvider(),
      market: { snapshot: (symbol) => this.snapshot(symbol) },
      storage: {
        get: <T,>(key: string) => AsyncStorage.getItem(key).then((v) => (v ? (JSON.parse(v) as T) : null)),
        set: async <T,>(key: string, value: T) => {
          await AsyncStorage.setItem(key, JSON.stringify(value));
        },
      },
      logger: this.storeLogger,
      providerFor: (mode): TradingProvider => {
        if (mode === 'live' && this.live) return this.live;
        return this.paper ?? this.live!;
      },
    });

    // Fire-and-forget state restore + ledger restore.
    void (async () => {
      await this.bot!.loadState();
      if (!this.bot!.config.symbols.length) {
        this.bot!.config.symbols = [...DEFAULT_SYMBOLS];
        await this.bot!.persistConfig();
      }
      const ledger = await AsyncStorage.getItem(this.paperLedgerKey);
      if (ledger) {
        const parsed = JSON.parse(ledger) as { usdtFree: number; assetFree: Record<string, number> };
        this.paper = new PaperProvider(parsed.usdtFree, (symbol) => this.prices[symbol] ?? NaN, parsed);
      }
      const bs = useBotStore.getState();
      bs.replaceConfig(this.bot!.config);
      bs.syncEngine({
        positions: this.bot!.positions,
        trades: this.bot!.trades,
      });
      bs.setRunning(this.bot!.running);
      this.storeLogger.log('info', `state restored — ${this.bot!.positions.length} open position(s), ${this.bot!.trades.length} trade(s)`);
      if (this.bot!.config.enabled) this.startBot();
    })();

    // Websocket market feed.
    this.ws?.stop();
    this.ws = new MarketStreams(
      creds.environment,
      (tickers) => this.onTickers(tickers),
      (connected) => useAuthStore.getState().setWsConnected(connected)
    );
    this.ws.start();

    void this.pollRestStatus();
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => void this.pollRestStatus(), 30_000);
  }

  activeProvider(): TradingProvider {
    return useAuthStore.getState().environment === 'live' && this.live ? this.live : this.paper ?? this.live!;
  }

  /* ------------------------------- market data ---------------------------- */

  private onTickers(tickers: MiniTicker[]): void {
    useMarketStore.getState().applyTickers(tickers);
    for (const t of tickers) this.prices[t.symbol] = t.close;
  }

  private async snapshot(symbol: string): Promise<SymbolMarketData> {
    if (!this.rest) throw new Error('not connected');
    const candles: Partial<Record<Timeframe, Candle[]>> = {};
    await Promise.all(
      ENGINE_TIMEFRAMES.map(async (tf) => {
        const key = `${symbol}:${tf}`;
        const cached = this.klineCache.get(key);
        if (cached && Date.now() - cached.at < (KLINE_TTL_MS[tf] ?? 30_000)) {
          candles[tf] = cached.candles;
          return;
        }
        try {
          const fresh = await this.rest!.klines(symbol, tf, KLINE_LIMIT);
          this.klineCache.set(key, { at: Date.now(), candles: fresh });
          candles[tf] = fresh;
        } catch {
          if (cached) candles[tf] = cached.candles; // stale fallback
        }
      })
    );
    return { symbol, candles, lastPrice: this.prices[symbol] };
  }

  /* ------------------------------- credentials ---------------------------- */

  async testAndSaveCredentials(apiKey: string, apiSecret: string, environment: Environment): Promise<{ ok: boolean; error?: string }> {
    const rest = new BinanceRest(apiKey, apiSecret, environment);
    try {
      const alive = await rest.ping();
      if (!alive) return { ok: false, error: `Cannot reach ${ENVIRONMENTS[environment].label}` };
      await rest.syncTime();
      const acct = await rest.account();
      if (!acct.canTrade) return { ok: false, error: 'API key cannot trade (check key permissions)' };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
    const creds: StoredCredentials = { apiKey, apiSecret, environment, savedAt: Date.now() };
    await saveCredentials(creds);
    useAuthStore.getState().setCredentials(creds);
    useAuthStore.getState().setEnvironment(environment);
    await this.wireCredentials(creds);
    this.storeLogger.log('info', `connected to ${ENVIRONMENTS[environment].label}`);
    return { ok: true };
  }

  async switchEnvironment(environment: Environment): Promise<void> {
    const creds = useAuthStore.getState().credentials;
    if (!creds) return;
    const updated = { ...creds, environment };
    await saveCredentials(updated);
    useAuthStore.getState().setCredentials(updated);
    useAuthStore.getState().setEnvironment(environment);
    await this.wireCredentials(updated);
    this.storeLogger.log('info', `switched to ${ENVIRONMENTS[environment].label}`);
  }

  async forgetCredentials(): Promise<void> {
    this.ws?.stop();
    this.ws = null;
    this.stopBotLoop();
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.rest = null;
    this.paper = null;
    this.live = null;
    this.bot = null;
    this.prices = {};
    this.klineCache.clear();
    useMarketStore.getState().reset();
    useBotStore.getState().reset();
    useAuthStore.getState().setCredentials(null);
    useAuthStore.getState().setRestStatus('unknown');
    useAuthStore.getState().setWsConnected(false);
    await clearCredentials();
    for (const key of [this.paperLedgerKey, STORAGE_KEYS.botConfig, STORAGE_KEYS.positions, STORAGE_KEYS.trades, '@aitb/bot.dayPnl']) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
    }
    this.storeLogger.log('warn', 'API credentials erased from this device');
  }

  /* --------------------------------- bot ---------------------------------- */

  startBot(): void {
    if (!this.bot) return;
    this.bot.start();
    useBotStore.getState().setRunning(true);
    this.restartTickLoop();
    void this.runTick();
  }

  stopBot(): void {
    if (!this.bot) return;
    this.bot.stop();
    useBotStore.getState().setRunning(false);
    this.stopBotLoop();
    // Keep ticking slowly so open positions keep their SL/TP protection.
    this.tickTimer = setInterval(() => void this.runTick(), 60_000);
  }

  async emergencyStop(): Promise<void> {
    if (!this.bot) return;
    useBotStore.getState().setTicking(true);
    try {
      await this.bot.emergencyStop(true);
    } finally {
      useBotStore.getState().setTicking(false);
      this.stopBotLoop();
      useBotStore.getState().setRunning(false);
      this.syncBotStore();
    }
  }

  private stopBotLoop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private restartTickLoop(): void {
    this.stopBotLoop();
    const interval = this.bot?.config.pollIntervalMs ?? 30_000;
    this.tickTimer = setInterval(() => void this.runTick(), Math.max(10_000, interval));
  }

  async runTick(): Promise<void> {
    if (!this.bot || !this.rest) return;
    useBotStore.getState().syncEngine({ ticking: true, positions: this.bot.positions, trades: this.bot.trades });
    try {
      await this.bot.tick();
      this.syncBotStore();
      await this.persistPaperLedger();
    } catch (e) {
      this.storeLogger.log('error', `tick failed: ${String(e)}`);
      useBotStore.getState().syncEngine({ ticking: false });
    }
  }

  private syncBotStore(): void {
    const bot = this.bot;
    if (!bot) return;
    // Apply live config edits from the store into the engine, then persist.
    const storeConfig = useBotStore.getState().config;
    const changed =
      JSON.stringify(storeConfig) !== JSON.stringify(bot.config);
    if (changed) {
      bot.config = storeConfig;
      void bot.persistConfig();
      if (bot.running) this.restartTickLoop();
    }
    useBotStore.getState().syncEngine({
      positions: bot.positions,
      trades: bot.trades,
      signals: bot.lastSignals,
      lastTickAt: Date.now(),
      ticking: false,
    });
  }

  private async persistPaperLedger(): Promise<void> {
    if (!this.paper) return;
    await AsyncStorage.setItem(this.paperLedgerKey, JSON.stringify(this.paper.snapshotLedger()));
  }

  async saveBotConfig(): Promise<void> {
    if (!this.bot) return;
    this.bot.config = useBotStore.getState().config;
    await this.bot.persistConfig();
  }

  /* ------------------------------- security ------------------------------- */

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    useAuthStore.getState().setBiometricEnabled(enabled);
    await saveSecuritySettings({ biometricEnabled: enabled });
  }

  /** Portfolio valuation across USDT / BTC / ETH for the dashboard. */
  async portfolio(): Promise<{
    usdt: number;
    btc: number;
    eth: number;
    equityUsdt: number;
    source: 'paper' | 'live';
  }> {
    const provider = this.activeProvider();
    const balances = await provider.getBalances();
    const priceOf = (symbol: string) => this.prices[symbol] ?? 0;
    let equity = balances.usdtFree;
    for (const [asset, qty] of Object.entries(balances.assetFree)) {
      if (asset === 'USDT') continue;
      const p = priceOf(`${asset}USDT`);
      equity += p > 0 ? qty * p : 0;
    }
    return {
      usdt: balances.usdtFree,
      btc: balances.assetFree.BTC ?? 0,
      eth: balances.assetFree.ETH ?? 0,
      equityUsdt: equity,
      source: provider.mode,
    };
  }

  private async pollRestStatus(): Promise<void> {
    if (!this.rest) return;
    const ok = await this.rest.ping();
    useAuthStore.getState().setRestStatus(ok ? 'ok' : 'fail');
  }

  price(symbol: string): number {
    return this.prices[symbol] ?? NaN;
  }

  /** Signals for a symbol on demand (Signals screen refresh). */
  async computeSignal(symbol: string): Promise<ReturnType<typeof generateSignal> | null> {
    if (!this.bot) return null;
    try {
      const data = await this.snapshot(symbol);
      return generateSignal(data);
    } catch {
      return null;
    }
  }
}

export const runtime = new AppRuntime();
