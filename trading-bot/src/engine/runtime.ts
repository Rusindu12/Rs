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
import { AdaptiveLearner, EMPTY_STATE, type AdaptiveState } from './adaptive';
import { effectiveWeights, TRAINED } from './training';
import { LiveProvider, PaperProvider } from './providers';
import { generateSignal } from './signalEngine';
import type { Signal } from './types';
import { simRng, simStep } from './offlineSim';
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
  private adaptiveKey = '@aitb/adaptive.v1';
  learner: AdaptiveLearner = new AdaptiveLearner();
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

    const demo = (await AsyncStorage.getItem(STORAGE_KEYS.demoMode)) === '1';
    useAuthStore.getState().setDemoMode(demo);

    try {
      const raw = await AsyncStorage.getItem(this.adaptiveKey);
      const saved = raw ? (JSON.parse(raw) as AdaptiveState) : null;
      this.learner = new AdaptiveLearner(saved ?? EMPTY_STATE);
    } catch {
      this.learner = new AdaptiveLearner();
    }

    const creds = await loadCredentials();
    useAuthStore.getState().setCredentials(creds);
    useAuthStore.getState().setHydrated(true);

    if (creds) {
      try {
        await this.wireCredentials(creds);
        void this.bot?.reconcileServerExits().catch(() => undefined);
      } catch (e) {
        this.storeLogger.log('error', `credential wiring failed: ${String(e)}`);
      }
    } else if (demo) {
      await this.wireDemo();
      // Demo = paper money. Auto-start so the app actually trades out of the
      // box instead of sitting idle behind a Start button nobody notices.
      this.startBot();
      this.storeLogger.log('info', 'demo bot auto-started — paper trading with $10,000 simulated funds');
    }
  }

  /**
   * Demo mode — no API keys. Public Binance market data (websocket tickers +
   * klines from the LIVE endpoint, both keyless) plus the paper trading
   * ledger. Everything works except real account trading.
   */
  private async wireDemo(): Promise<void> {
    this.rest = new BinanceRest('', '', 'live');
    this.paper = new PaperProvider(10_000, (symbol) => this.prices[symbol] ?? NaN);
    this.live = null;

    this.bot = new BotEngine({
      provider: this.paper,
      market: { snapshot: (symbol) => this.snapshot(symbol) },
      storage: {
        get: <T,>(key: string) => AsyncStorage.getItem(key).then((v) => (v ? (JSON.parse(v) as T) : null)),
        set: async <T,>(key: string, value: T) => {
          await AsyncStorage.setItem(key, JSON.stringify(value));
        },
      },
      logger: this.storeLogger,
      providerFor: () => this.paper ?? this.live!,
      weightsProvider: () => effectiveWeights(this.learner.state.scales),
    });
    await this.restoreBotState();

    this.ws?.stop();
    this.ws = new MarketStreams(
      'live',
      (tickers) => this.onTickers(tickers),
      (connected) => this.onWsStatus(connected)
    );
    this.ws.start();

    void this.pollRestStatus();
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => void this.pollRestStatus(), 30_000);
    this.storeLogger.log('info', 'demo mode — live market data + paper trading (no API keys)');
  }

  async enableDemoMode(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.demoMode, '1');
    useAuthStore.getState().setDemoMode(true);
    await this.wireDemo();
  }

  /** Leave demo mode (returns the user to the API setup screen). */
  async disableDemoMode(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.demoMode);
    useAuthStore.getState().setDemoMode(false);
  }

  /** Shared: restore persisted bot config/positions/trades + paper ledger. */
  private async restoreBotState(): Promise<void> {
    if (!this.bot) return;
    await this.bot.loadState();
    if (!this.bot.config.symbols.length) {
      this.bot.config.symbols = [...DEFAULT_SYMBOLS];
      await this.bot.persistConfig();
    }
    const ledger = await AsyncStorage.getItem(this.paperLedgerKey);
    if (ledger) {
      const parsed = JSON.parse(ledger) as { usdtFree: number; assetFree: Record<string, number> };
      this.paper = new PaperProvider(parsed.usdtFree, (symbol) => this.prices[symbol] ?? NaN, parsed);
    }
    const bs = useBotStore.getState();
    bs.replaceConfig(this.bot.config);
    bs.syncEngine({
      positions: this.bot.positions,
      trades: this.bot.trades,
    });
    bs.setRunning(this.bot.running);
    this.storeLogger.log('info', `state restored — ${this.bot.positions.length} open position(s), ${this.bot.trades.length} trade(s)`);
    if (this.bot.config.enabled) this.startBot();
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
      weightsProvider: () => effectiveWeights(this.learner.state.scales),
    });

    await this.restoreBotState();

    // Websocket market feed.
    this.ws?.stop();
    this.ws = new MarketStreams(
      creds.environment,
      (tickers) => this.onTickers(tickers),
      (connected) => this.onWsStatus(connected)
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
    this.stopOfflineSim(false);
    useMarketStore.getState().applyTickers(tickers);
    for (const t of tickers) {
      this.prices[t.symbol] = t.close;
      if (!this.simAnchors.has(t.symbol)) this.simAnchors.set(t.symbol, t.close);
      this.learner.onPrice(t.symbol, t.close);
    }
  }

  /* ------------ offline resilience (demo keeps trading) ------------------- */

  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simAnchors = new Map<string, number>();
  private simRands = new Map<string, () => number>();
  private offlineLogged = false;

  /** WS/连接 status → simulate offline demo trading, or resume on reconnect. */
  private onWsStatus(ok: boolean): void {
    const st = useAuthStore.getState();
    st.setWsConnected(ok);
    if (!ok) {
      if (st.demoMode) {
        this.startOfflineSim();
      } else if (!this.offlineLogged) {
        this.offlineLogged = true;
        this.storeLogger.log('warn', 'offline — live trading paused (orders need internet); it resumes automatically when the connection returns');
      }
    } else {
      this.offlineLogged = false;
      if (st.simulated) {
        this.storeLogger.log('info', 'connection restored — real prices resumed');
      }
      this.stopOfflineSim(true);
      if (!st.demoMode && this.bot) {
        void this.bot.reconcileServerExits().catch(() => undefined);
      }
      void this.runTick(); // catch up immediately
    }
  }

  /** Demo only: keep paper trading on a mean-reverting simulated price walk. */
  private startOfflineSim(): void {
    if (this.simTimer || !useAuthStore.getState().demoMode) return;
    useAuthStore.getState().setSimulated(true);
    this.storeLogger.log('warn', 'offline — demo trading continues with SIMULATED prices (paper money only)');
    this.simTimer = setInterval(() => {
      const symbols = new Set([...(this.bot?.config.symbols ?? []), ...Object.keys(this.prices)]);
      for (const sym of symbols) {
        const p = this.prices[sym];
        if (!p || !isFinite(p) || p <= 0) continue;
        if (!this.simAnchors.has(sym)) this.simAnchors.set(sym, p);
        if (!this.simRands.has(sym)) this.simRands.set(sym, simRng(sym));
        this.prices[sym] = simStep(p, this.simRands.get(sym)!, this.simAnchors.get(sym)!);
      }
    }, 3_000);
  }

  private stopOfflineSim(logRestore: boolean): void {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (useAuthStore.getState().simulated) {
      useAuthStore.getState().setSimulated(false);
      if (logRestore) this.storeLogger.log('info', 'connection restored — live prices resumed');
    }
  }

  /** Diagnostics: why the engine might not be trading. */
  private dataFailures = 0;
  private lastDataError = '';

  engineHealth(): {
    restBase: string;
    wsConnected: boolean;
    klinesCached: number;
    dataFailures: number;
    lastDataError: string;
  } {
    return {
      restBase: this.rest?.activePublicBase || (this.rest ? 'connecting…' : 'not connected'),
      wsConnected: useAuthStore.getState().wsConnected,
      klinesCached: this.klineCache.size,
      dataFailures: this.dataFailures,
      lastDataError: this.lastDataError,
    };
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
        } catch (e) {
          this.dataFailures++;
          this.lastDataError = `${symbol} ${tf}: ${String(e).slice(0, 120)}`;
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
    const conn = useAuthStore.getState();
    if (!conn.wsConnected && !conn.demoMode) {
      if (!this.offlineLogged) {
        this.offlineLogged = true;
        this.storeLogger.log('warn', 'offline — live trading paused; it resumes automatically when back online');
      }
      return;
    }
    useBotStore.getState().syncEngine({ ticking: true, positions: this.bot.positions, trades: this.bot.trades });
    try {
      const result = await this.bot.tick();
      // heartbeat: make every scan visible so "is it working?" is always answerable
      try {
        const best = result.signals.reduce<Signal | null>((b, x) => (!b || Math.abs(x.score) > Math.abs(b.score) ? x : b), null);
        const floor = this.bot.config.tradeMode === 'chill'
          ? 30
          : this.bot.config.tradeMode === 'turbo'
            ? 8
            : 20;
        const eligible = result.signals.filter((x) => x.score >= floor).length;
        this.storeLogger.log(
          'info',
          `scanned ${result.signals.length} · best ${best ? `${best.symbol} ${best.score >= 0 ? '+' : ''}${best.score.toFixed(0)} (${best.action})` : '—'} · entry-ready ${eligible} · opened ${result.opened.length} · closed ${result.closed.length}`
        );
      } catch {
        /* heartbeat must never break the tick */
      }
      // continual learning: record fresh signals, resolve matured ones
      for (const sig of result.signals) {
        this.learner.record({
          symbol: sig.symbol,
          action: sig.action,
          score: sig.score,
          price: sig.price,
          computedAt: sig.computedAt,
          factors: sig.factors.map((f) => ({ name: f.name, score: f.score })),
        });
      }
      this.syncBotStore();
      await this.persistPaperLedger();
      await this.persistAdaptive();
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

  private async persistAdaptive(): Promise<void> {
    await AsyncStorage.setItem(this.adaptiveKey, JSON.stringify(this.learner.state)).catch(() => undefined);
  }

  async resetAdaptive(): Promise<void> {
    this.learner = new AdaptiveLearner();
    await this.persistAdaptive();
    this.storeLogger.log('info', 'adaptive learning reset');
  }

  learningSummary(): {
    trained: { at: string; source: string; classAcc: number; adopted: boolean; buyAcc: number | null; sellAcc: number | null; holdAcc: number | null };
    adaptive: ReturnType<AdaptiveLearner['stats']>;
    scales: Record<string, number>;
  } {
    const st = this.learner.stats();
    return {
      trained: {
        at: TRAINED.trainedAt,
        source: TRAINED.dataSource,
        classAcc: TRAINED.performance.classAcc,
        adopted: TRAINED.performance.adopted !== false,
        buyAcc: TRAINED.performance.decisions.buy.accuracy,
        sellAcc: TRAINED.performance.decisions.sell.accuracy,
        holdAcc: TRAINED.performance.decisions.hold.accuracy,
      },
      adaptive: st,
      scales: { ...this.learner.state.scales },
    };
  }

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
