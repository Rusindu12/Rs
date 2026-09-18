import { BOT_DEFAULTS, MIN_NOTIONAL_USDT, STORAGE_KEYS } from '../config';
import type {
  BotConfig,
  Position,
  Signal,
  SymbolMarketData,
  TradeRecord,
  TradingProvider,
} from './types';
import { shouldEnter, type TradeMode } from './types';
import { checkEntryRisk, checkExit, unrealizedPnl } from './riskManager';
import { generateSignal } from './signalEngine';
import type { EffectiveWeights } from './training';

/* ------------------------------------------------------------------ */
/* Injectable ports (make the engine fully unit-testable)              */
/* ------------------------------------------------------------------ */

export interface MarketDataPort {
  /** Latest multi-timeframe snapshot for a symbol. */
  snapshot(symbol: string): Promise<SymbolMarketData>;
}

export interface BotStoragePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface BotClockPort {
  now(): number;
}

export interface BotLogPort {
    log(level: 'info' | 'warn' | 'error' | 'trade', message: string): void;
}

export class ConsoleLog implements BotLogPort {
  log(level: string, message: string) {
    console.log(`[bot][${level}] ${message}`);
  }
}

export const memoryStorage = (): BotStoragePort => {
  const m = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return (m.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T) {
      m.set(key, value);
    },
  };
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
  enabled: false,
  symbols: BOT_DEFAULTS ? [...([] as string[])] : [],
  tradeAmountUsdt: BOT_DEFAULTS.tradeAmountUsdt,
  maxOpenTrades: BOT_DEFAULTS.maxOpenTrades,
  stopLossPct: BOT_DEFAULTS.stopLossPct,
  takeProfitPct: BOT_DEFAULTS.takeProfitPct,
  dailyLossLimitPct: BOT_DEFAULTS.dailyLossLimitPct,
  minSignal: BOT_DEFAULTS.minSignal,
  tradeMode: 'normal',
  maxHoldHours: 8,
  pollIntervalMs: BOT_DEFAULTS.pollIntervalMs,
  useAtrStops: true,
  confidenceSizing: true,
};

export interface BotTickResult {
  signals: Signal[];
  opened: TradeRecord[];
  closed: TradeRecord[];
}

/**
 * AI Trading Bot engine — one `tick()` drives a full evaluation cycle:
 * fetch market data → generate signals → manage risk → enter/exit trades.
 *
 * The class itself is UI-agnostic; the app layer wires it to zustand stores,
 * AsyncStorage, the Binance REST client and a React Native timer.
 */
export class BotEngine {
  config: BotConfig = {
    ...DEFAULT_BOT_CONFIG,
    symbols: [],
  };
  provider: TradingProvider;
  market: MarketDataPort;
  storage: BotStoragePort;
  clock: BotClockPort;
  logger: BotLogPort;

  positions: Position[] = [];
  trades: TradeRecord[] = [];
  lastSignals: Signal[] = [];
  running = false;
  private ticking = false;
  private dayKey = '';
  private realizedTodayUsdt = 0;

  providerFor: (mode: 'paper' | 'live') => TradingProvider;

  constructor(deps: {
    provider: TradingProvider;
    market: MarketDataPort;
    storage: BotStoragePort;
    clock?: BotClockPort;
    logger?: BotLogPort;
    /** Resolve a provider by mode so paper positions are always paper-closed. */
    providerFor?: (mode: 'paper' | 'live') => TradingProvider;
    /** Live weights (trained × adaptive) resolved fresh on every signal. */
    weightsProvider?: () => EffectiveWeights;
  }) {
    this.provider = deps.provider;
    this.market = deps.market;
    this.storage = deps.storage;
    this.clock = deps.clock ?? { now: () => Date.now() };
    this.logger = deps.logger ?? new ConsoleLog();
    this.providerFor =
      deps.providerFor ?? ((mode) => (mode === this.provider.mode ? this.provider : this.provider));
    this.weightsProvider = deps.weightsProvider;
  }

  private weightsProvider?: () => EffectiveWeights;

  /* ----------------------------- persistence ----------------------------- */

  async loadState(): Promise<void> {
    const cfg = await this.storage.get<BotConfig>(STORAGE_KEYS.botConfig);
    if (cfg) this.config = { ...this.config, ...cfg };
    this.positions = (await this.storage.get<Position[]>(STORAGE_KEYS.positions)) ?? [];
    this.trades = (await this.storage.get<TradeRecord[]>(STORAGE_KEYS.trades)) ?? [];
    const key = this.dayKeyOf();
    const saved = await this.storage.get<{ key: string; pnl: number }>('@aitb/bot.dayPnl');
    if (saved && saved.key === key) this.realizedTodayUsdt = saved.pnl;
    this.dayKey = key;
  }

  async persistConfig(): Promise<void> {
    await this.storage.set(STORAGE_KEYS.botConfig, this.config);
  }

  private async persistPositions(): Promise<void> {
    await this.storage.set(STORAGE_KEYS.positions, this.positions);
  }

  private async persistTrades(): Promise<void> {
    // Cap the in-app ledger at 500 most recent trades.
    await this.storage.set(STORAGE_KEYS.trades, this.trades.slice(-500));
  }

  private async persistDayPnl(): Promise<void> {
    await this.storage.set('@aitb/bot.dayPnl', { key: this.dayKey, pnl: this.realizedTodayUsdt });
  }

  private dayKeyOf(): string {
    return new Date(this.clock.now()).toISOString().slice(0, 10);
  }

  /* ------------------------------ lifecycle ------------------------------ */

  start(): void {
    this.running = true;
    this.config.enabled = true;
    void this.persistConfig();
    this.logger.log('info', `bot started (${this.provider.mode} mode)`);
  }

  stop(): void {
    this.running = false;
    this.config.enabled = false;
    void this.persistConfig();
    this.logger.log('info', 'bot stopped — open positions remain, monitored manually');
  }

  async emergencyStop(closePositions = true): Promise<TradeRecord[]> {
    this.stop();
    const closed: TradeRecord[] = [];
    if (closePositions) {
      for (const p of [...this.positions]) {
        try {
          closed.push(await this.closePosition(p, 'EMERGENCY_STOP'));
        } catch (e) {
          this.logger.log('error', `emergency close failed for ${p.symbol}: ${String(e)}`);
        }
      }
      try {
        for (const s of new Set([...this.positions.map((p) => p.symbol), ...this.config.symbols])) {
          await this.provider.cancelAllOrders(s);
        }
      } catch (e) {
        this.logger.log('warn', `cancelAllOrders: ${String(e)}`);
      }
    }
    this.logger.log('warn', `EMERGENCY STOP executed — ${closed.length} position(s) closed`);
    return closed;
  }

  /* -------------------------------- tick --------------------------------- */

  /** One evaluation cycle across the watchlist. Safe to call concurrently (re-entrancy guarded). */
  async tick(): Promise<BotTickResult> {
    if (this.ticking) return { signals: this.lastSignals, opened: [], closed: [] };
    this.ticking = true;
    const opened: TradeRecord[] = [];
    const closed: TradeRecord[] = [];
    try {
      this.rollDayIfNeeded();
      const balances = await this.provider.getBalances();
      const signals: Signal[] = [];

      for (const symbol of this.config.symbols) {
        let data: SymbolMarketData;
        try {
          data = await this.market.snapshot(symbol);
        } catch (e) {
          this.logger.log('warn', `market data unavailable for ${symbol}: ${String(e)}`);
          continue;
        }
        let signal: Signal;
        try {
          const w = this.weightsProvider?.() ?? undefined;
          const mode: TradeMode = this.config.tradeMode ?? 'chill';
          signal = generateSignal(data, mode === 'turbo' && w ? { ...w, regimeGate: false } : w);
        } catch (e) {
          this.logger.log('warn', `signal failed for ${symbol}: ${String(e)}`);
          continue;
        }
        signals.push(signal);

        const position = this.positions.find((p) => p.symbol === symbol);
        const price = data.lastPrice ?? signal.price;

        if (position) {
          const exit = checkExit(position, price, signal.action, {
            score: signal.score,
            heldMs: this.clock.now() - position.openedAt,
            maxHoldMs: this.config.maxHoldHours > 0 ? this.config.maxHoldHours * 3_600_000 : null,
          });
          if (exit.exit) {
            closed.push(await this.closePosition(position, exit.reason!));
          }
          continue; // one position per symbol
        }

        if (!this.running) continue;
        if (!shouldEnter(signal.score, signal.action, this.config.tradeMode ?? 'chill', this.config.minSignal)) continue;

        const risk = checkEntryRisk({
          config: this.config,
          positions: this.positions,
          symbol,
          freeUsdt: balances.usdtFree,
          realizedPnlTodayUsdt: this.realizedTodayUsdt,
          equityUsdt: balances.equityUsdt,
        });
        if (!risk.allowed) {
          this.logger.log('info', `skip ${symbol} ${signal.action}: ${risk.reason}`);
          continue;
        }

        opened.push(await this.openPosition(symbol, risk.sizeUsdt, signal, price, balances.assetFree));
      }

      this.lastSignals = signals;
      return { signals, opened, closed };
    } finally {
      this.ticking = false;
    }
  }

  /* ------------------------------ executions ----------------------------- */

  private async openPosition(
    symbol: string,
    sizeUsdt: number,
    signal: Signal,
    price: number,
    _assetFree: Record<string, number>
  ): Promise<TradeRecord> {
    // AI confidence sizing: scale 0.75×–1× of the configured size.
    let size = sizeUsdt;
    if (this.config.confidenceSizing) {
      size = Math.round(sizeUsdt * (0.75 + 0.25 * (signal.confidence / 100)) * 100) / 100;
      size = Math.max(MIN_NOTIONAL_USDT, size);
    }
    // ATR-aware SL/TP: trained risk params seed the distances, volatility widens them, capped 2×.
    const atrPct = signal.extras && isFinite(signal.extras.atrPct) ? signal.extras.atrPct : 0;
    const trainedRisk = this.weightsProvider?.().risk;
    let slPct = trainedRisk?.stopLossPct ?? this.config.stopLossPct;
    let tpPct = trainedRisk?.takeProfitPct ?? this.config.takeProfitPct;
    if (this.config.useAtrStops && atrPct > 0) {
      slPct = Math.min(Math.max(slPct, 1.2 * atrPct), slPct * 2);
      tpPct = Math.min(Math.max(tpPct, 2 * atrPct), tpPct * 2);
    }

    const { qty, price: fillPrice, feeUsdt } = await this.provider.marketBuy(symbol, size);
    const entry = fillPrice > 0 ? fillPrice : price;
    const position: Position = {
      id: `${symbol}-${this.clock.now()}`,
      symbol,
      side: 'LONG',
      qty,
      entryPrice: entry,
      openedAt: this.clock.now(),
      stopLoss: entry * (1 - slPct / 100),
      takeProfit: entry * (1 + tpPct / 100),
      tradeAmountUsdt: size,
      mode: this.provider.mode,
      signalAtEntry: `${signal.action} (${signal.score}, conf ${signal.confidence}%)`,
    };
    this.positions.push(position);
    const record: TradeRecord = {
      id: position.id,
      symbol,
      side: 'BUY',
      qty,
      entryPrice: entry,
      openedAt: position.openedAt,
      mode: this.provider.mode,
      status: 'OPEN',
      reason: `${signal.action} score ${signal.score} conf ${signal.confidence}%${signal.extras?.pattern ? ` · ${signal.extras.pattern}` : ''}${signal.extras?.divergence ? ` · ${signal.extras.divergence} div` : ''} | SL ${slPct.toFixed(1)}% / TP ${tpPct.toFixed(1)}%`,
      feeUsdt,
    };
    this.trades.push(record);
    await Promise.all([this.persistPositions(), this.persistTrades()]);
    this.logger.log('trade', `OPEN ${symbol} qty ${qty} @ ${entry} — ${record.reason}`);
    return record;
  }

  async closePosition(position: Position, reason: string): Promise<TradeRecord> {
    const { price, proceedsUsdt, feeUsdt } = await this.provider.marketSell(position.symbol, position.qty);
    const idx = this.positions.indexOf(position);
    if (idx >= 0) this.positions.splice(idx, 1);

    const exit = price > 0 ? price : proceedsUsdt / Math.max(1e-12, position.qty);
    const gross = (exit - position.entryPrice) * position.qty;
    const pnl = gross - feeUsdt;
    const record = this.trades.find((t) => t.id === position.id && t.status === 'OPEN');
    if (record) {
      record.status = 'CLOSED';
      record.exitPrice = exit;
      record.closedAt = this.clock.now();
      record.pnlUsdt = pnl;
      record.pnlPct = (pnl / Math.max(1e-12, position.entryPrice * position.qty)) * 100;
      record.reason = `${record.reason} → ${reason}`;
      record.feeUsdt = (record.feeUsdt ?? 0) + feeUsdt;
    }
    this.realizedTodayUsdt += pnl;
    await Promise.all([this.persistPositions(), this.persistTrades(), this.persistDayPnl()]);
    this.logger.log(
      'trade',
      `CLOSE ${position.symbol} @ ${exit} — ${reason} — PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`
    );
    return record ?? {
      id: position.id,
      symbol: position.symbol,
      side: 'SELL',
      qty: position.qty,
      entryPrice: position.entryPrice,
      exitPrice: exit,
      openedAt: position.openedAt,
      closedAt: this.clock.now(),
      pnlUsdt: pnl,
      pnlPct: (pnl / Math.max(1e-12, position.entryPrice * position.qty)) * 100,
      mode: position.mode,
      status: 'CLOSED',
      reason,
    };
  }

  /** Live PnL per open position against `prices`. */
  markToMarket(prices: Record<string, number>): { position: Position; pnlUsdt: number; pnlPct: number }[] {
    return this.positions.map((p) => {
      const price = prices[p.symbol] ?? p.entryPrice;
      const { usdt, pct } = unrealizedPnl(p, price);
      return { position: p, pnlUsdt: usdt, pnlPct: pct };
    });
  }

  realizedPnlToday(): number {
    this.rollDayIfNeeded();
    return this.realizedTodayUsdt;
  }

  private rollDayIfNeeded(): void {
    const key = this.dayKeyOf();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.realizedTodayUsdt = 0;
    }
  }

  /** Win/loss stats over closed trades. */
  stats(): { total: number; wins: number; losses: number; winRatePct: number; totalPnlUsdt: number } {
    const closed = this.trades.filter((t) => t.status === 'CLOSED');
    const wins = closed.filter((t) => (t.pnlUsdt ?? 0) > 0).length;
    const losses = closed.filter((t) => (t.pnlUsdt ?? 0) <= 0).length;
    return {
      total: closed.length,
      wins,
      losses,
      winRatePct: closed.length ? (wins / closed.length) * 100 : 0,
      totalPnlUsdt: closed.reduce((s, t) => s + (t.pnlUsdt ?? 0), 0),
    };
  }

  /** Realized PnL bucketed for the dashboard (daily / weekly / monthly / all-time). */
  realizedPnlBuckets(): { daily: number; weekly: number; monthly: number; allTime: number } {
    const now = this.clock.now();
    const dayMs = 86_400_000;
    const inRange = (t: TradeRecord, from: number) =>
      t.status === 'CLOSED' && (t.closedAt ?? 0) >= from;
    const sum = (list: TradeRecord[]) => list.reduce((s, t) => s + (t.pnlUsdt ?? 0), 0);
    const closed = this.trades.filter((t) => t.status === 'CLOSED');
    return {
      daily: sum(closed.filter((t) => inRange(t, now - dayMs))),
      weekly: sum(closed.filter((t) => inRange(t, now - 7 * dayMs))),
      monthly: sum(closed.filter((t) => inRange(t, now - 30 * dayMs))),
      allTime: sum(closed),
    };
  }
}
