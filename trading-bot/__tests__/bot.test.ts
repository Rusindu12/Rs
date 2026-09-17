import { BotEngine, memoryStorage } from '../src/engine/tradingBot';
import { PaperProvider } from '../src/engine/providers';
import { checkEntryRisk, checkExit, unrealizedPnl } from '../src/engine/riskManager';
import type { BotConfig, Position, SymbolMarketData, TradingProvider } from '../src/engine/types';
import { makeCandles } from './signalEngine.test';

const UP = () => makeCandles({ driftPctPerCandle: 0.15, count: 250, seed: 8, noisePct: 0.7, finalVolumeSpike: true });
const DOWN = () => makeCandles({ driftPctPerCandle: -0.15, count: 250, seed: 2, noisePct: 0.7, finalVolumeSpike: true });
const FLAT = () => makeCandles({ driftPctPerCandle: 0, count: 250, seed: 5, noisePct: 0.5 });

function fakeMarket(symbols: Record<string, SymbolMarketData>, priceOverrides: Record<string, number> = {}) {
  return {
    async snapshot(symbol: string) {
      const d = symbols[symbol];
      if (!d) throw new Error(`no fixture for ${symbol}`);
      return { ...d, lastPrice: priceOverrides[symbol] ?? d.lastPrice };
    },
  };
}

/** Market fixture whose live price can be moved between ticks. */
function priceOverrideMarket(symbol: string, candles: SymbolMarketData['candles']) {
  const overrides: Record<string, number> = {};
  const market = fakeMarket({ [symbol]: { symbol, candles, lastPrice: 100 } }, overrides);
  return { market, overrides };
}

class FakeProvider implements TradingProvider {
  mode = 'paper' as const;
  buys: { symbol: string; quoteQty: number }[] = [];
  sells: { symbol: string; qty: number }[] = [];
  usdt = 10_000;
  assets: Record<string, number> = {};
  entryPrice = 100;

  async getBalances() {
    return { usdtFree: this.usdt, assetFree: { ...this.assets }, equityUsdt: this.usdt };
  }
  async marketBuy(symbol: string, quoteQty: number) {
    this.buys.push({ symbol, quoteQty });
    this.usdt -= quoteQty;
    const qty = quoteQty / this.entryPrice;
    this.assets[symbol.replace('USDT', '')] = (this.assets[symbol.replace('USDT', '')] ?? 0) + qty;
    return { qty, price: this.entryPrice, feeUsdt: quoteQty * 0.001 };
  }
  async marketSell(symbol: string, qty: number) {
    this.sells.push({ symbol, qty });
    const proceeds = qty * this.entryPrice;
    this.usdt += proceeds;
    this.assets[symbol.replace('USDT', '')] -= qty;
    return { price: this.entryPrice, proceedsUsdt: proceeds, feeUsdt: proceeds * 0.001 };
  }
  async cancelAllOrders() {}
}

const baseConfig = (): BotConfig => ({
  enabled: false,
  symbols: ['UPUSDT'],
  tradeAmountUsdt: 100,
  maxOpenTrades: 3,
  stopLossPct: 2,
  takeProfitPct: 4,
  dailyLossLimitPct: 6,
  minSignal: 'BUY',
  pollIntervalMs: 30_000,
  useAtrStops: true,
  confidenceSizing: true,
});

function makeBot(market: ReturnType<typeof fakeMarket>, provider: TradingProvider, config = baseConfig()) {
  const bot = new BotEngine({
    provider,
    market,
    storage: memoryStorage(),
    clock: { now: () => 1_700_000_000_000 },
  });
  bot.config = config;
  return bot;
}

describe('riskManager', () => {
  it('blocks a second position on the same symbol', () => {
    const pos = {
      id: '1', symbol: 'BTCUSDT', side: 'LONG' as const, qty: 1, entryPrice: 100,
      openedAt: 0, stopLoss: 98, takeProfit: 104, tradeAmountUsdt: 100, mode: 'paper' as const, signalAtEntry: 'BUY',
    };
    const d = checkEntryRisk({
      config: baseConfig(), positions: [pos], symbol: 'BTCUSDT',
      freeUsdt: 1000, realizedPnlTodayUsdt: 0, equityUsdt: 10_000,
    });
    expect(d.allowed).toBe(false);
  });

  it('caps size at free USDT and enforces min notional', () => {
    const d = checkEntryRisk({
      config: baseConfig(), positions: [], symbol: 'BTCUSDT',
      freeUsdt: 40, realizedPnlTodayUsdt: 0, equityUsdt: 10_000,
    });
    expect(d.allowed).toBe(true);
    expect(d.sizeUsdt).toBe(40);
    const d2 = checkEntryRisk({
      config: baseConfig(), positions: [], symbol: 'BTCUSDT',
      freeUsdt: 3, realizedPnlTodayUsdt: 0, equityUsdt: 10_000,
    });
    expect(d2.allowed).toBe(false);
  });

  it('trips the daily loss circuit breaker', () => {
    const cfg = { ...baseConfig(), dailyLossLimitPct: 5 };
    const d = checkEntryRisk({
      config: cfg, positions: [], symbol: 'BTCUSDT',
      freeUsdt: 1000, realizedPnlTodayUsdt: -600, equityUsdt: 10_000,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('daily loss limit');
  });

  it('detects stop-loss, take-profit and signal exits', () => {
    const pos: Position = {
      id: '1', symbol: 'X', side: 'LONG', qty: 1, entryPrice: 100, openedAt: 0,
      stopLoss: 98, takeProfit: 104, tradeAmountUsdt: 100, mode: 'paper', signalAtEntry: 'BUY',
    };
    expect(checkExit(pos, 97.9, 'HOLD').reason).toBe('STOP_LOSS');
    expect(checkExit(pos, 104.1, 'HOLD').reason).toBe('TAKE_PROFIT');
    expect(checkExit(pos, 100, 'STRONG_SELL').reason).toBe('SIGNAL_EXIT');
    expect(checkExit(pos, 100, 'HOLD').exit).toBe(false);
    expect(unrealizedPnl(pos, 102).usdt).toBeCloseTo(2);
  });
});

describe('BotEngine', () => {
  const upMarket = () => priceOverrideMarket('UPUSDT', { '15m': UP() });

  it('opens a position when the signal meets the threshold, with SL/TP set', async () => {
    const provider = new FakeProvider();
    const { market } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    bot.start();
    const { opened } = await bot.tick();
    expect(opened).toHaveLength(1);
    expect(provider.buys).toHaveLength(1);
    // Confidence sizing: 0.75×–1× of the configured $100.
    const spent = provider.buys[0].quoteQty;
    expect(spent).toBeGreaterThanOrEqual(75);
    expect(spent).toBeLessThanOrEqual(100);
    const pos = bot.positions[0];
    // ATR-aware stops: SL within [1×, 2×] of the configured 2 %.
    const slPct = ((pos.entryPrice - pos.stopLoss) / pos.entryPrice) * 100;
    expect(slPct).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(slPct).toBeLessThanOrEqual(4 + 1e-6);
    const tpPct = ((pos.takeProfit - pos.entryPrice) / pos.entryPrice) * 100;
    expect(tpPct).toBeGreaterThanOrEqual(4 - 1e-6);
    expect(tpPct).toBeLessThanOrEqual(8 + 1e-6);
  });

  it('does not open twice on the same symbol', async () => {
    const provider = new FakeProvider();
    const { market } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    bot.start();
    await bot.tick();
    await bot.tick();
    expect(provider.buys).toHaveLength(1);
  });

  it('does not open anything before start()', async () => {
    const provider = new FakeProvider();
    const { market } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    const { opened } = await bot.tick();
    expect(opened).toHaveLength(0);
    expect(provider.buys).toHaveLength(0);
  });

  it('closes at take-profit and books the PnL', async () => {
    const provider = new FakeProvider();
    const { market, overrides } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    bot.start();
    await bot.tick();
    const pos = bot.positions[0];
    // Price rallies past TP.
    provider.entryPrice = pos.takeProfit * 1.001;
    overrides.UPUSDT = pos.takeProfit * 1.001;
    const { closed } = await bot.tick();
    expect(closed).toHaveLength(1);
    expect(closed[0].reason).toContain('TAKE_PROFIT');
    expect(closed[0].pnlUsdt).toBeGreaterThan(0);
    expect(bot.positions).toHaveLength(0);
    expect(bot.realizedPnlToday()).toBeCloseTo(closed[0].pnlUsdt!, 6);
  });

  it('closes at stop-loss with a negative PnL', async () => {
    const provider = new FakeProvider();
    const { market, overrides } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    bot.start();
    await bot.tick();
    provider.entryPrice = bot.positions[0].stopLoss * 0.999;
    overrides.UPUSDT = bot.positions[0].stopLoss * 0.999;
    const { closed } = await bot.tick();
    expect(closed[0].reason).toContain('STOP_LOSS');
    expect(closed[0].pnlUsdt).toBeLessThan(0);
  });

  it('exits on a SELL signal even above stop-loss', async () => {
    const provider = new FakeProvider();
    const overrides: Record<string, number> = {};
    const candles = { UP: UP(), DOWN: DOWN() };
    const market = fakeMarket(
      {
        SWAP: { symbol: 'SWAP', candles: { '15m': candles.UP } },
      },
      overrides
    );
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['SWAP'] });
    bot.start();
    await bot.tick();
    expect(bot.positions).toHaveLength(1);
    // Flip the fixture to the downtrend series and keep price mid-range.
    (market as unknown as { fixtures?: unknown }).fixtures = null;
    const flipped = fakeMarket({ SWAP: { symbol: 'SWAP', candles: { '15m': candles.DOWN }, lastPrice: 100 } }, {});
    // splice the new market data source into the engine
    (bot as unknown as { market: unknown }).market = flipped;
    const { closed } = await bot.tick();
    expect(closed).toHaveLength(1);
    expect(closed[0].reason).toContain('SIGNAL_EXIT');
  });

  it('respects maxOpenTrades', async () => {
    const provider = new FakeProvider();
    const market = fakeMarket({
      A: { symbol: 'A', candles: { '15m': UP() } },
      B: { symbol: 'B', candles: { '15m': UP() } },
      C: { symbol: 'C', candles: { '15m': UP() } },
      D: { symbol: 'D', candles: { '15m': UP() } },
    });
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['A', 'B', 'C', 'D'], maxOpenTrades: 2 });
    bot.start();
    await bot.tick();
    expect(bot.positions).toHaveLength(2);
    expect(provider.buys).toHaveLength(2);
  });

  it('blocks entries once the daily loss limit is reached', async () => {
    const provider = new FakeProvider();
    const { market, overrides } = upMarket();
    const bot = makeBot(market, provider, {
      ...baseConfig(),
      symbols: ['UPUSDT'],
      tradeAmountUsdt: 500,
      dailyLossLimitPct: 1,
    });
    bot.start();
    await bot.tick(); // open
    // Force a stop-loss far below entry → realized loss ≈ 5% of equity.
    provider.entryPrice = 1;
    overrides.UPUSDT = 1;
    const { closed } = await bot.tick();
    expect(closed).toHaveLength(1);
    const loss = closed[0].pnlUsdt!;
    expect(loss).toBeLessThan(-400);
    provider.entryPrice = 100;
    overrides.UPUSDT = 100;
    const { opened } = await bot.tick();
    expect(opened).toHaveLength(0);
  });

  it('emergency stop flattens everything and halts the bot', async () => {
    const provider = new FakeProvider();
    const { market } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    bot.config.symbols = ['UPUSDT'];
    bot.start();
    await bot.tick();
    expect(bot.positions).toHaveLength(1);
    const closed = await bot.emergencyStop(true);
    expect(closed).toHaveLength(1);
    expect(bot.positions).toHaveLength(0);
    expect(bot.running).toBe(false);
  });

  it('holds below the configured signal strength', async () => {
    const provider = new FakeProvider();
    const bot = makeBot(fakeMarket({ F: { symbol: 'F', candles: { '15m': FLAT() } } }), provider, {
      ...baseConfig(),
      symbols: ['F'],
      minSignal: 'STRONG_BUY',
    });
    bot.start();
    const { opened } = await bot.tick();
    expect(opened).toHaveLength(0);
  });

  it('persists and restores state through storage', async () => {
    const provider = new FakeProvider();
    const storage = memoryStorage();
    const { market } = upMarket();
    const bot = makeBot(market, provider, { ...baseConfig(), symbols: ['UPUSDT'] });
    (bot as unknown as { storage: typeof storage }).storage = storage;
    bot.start();
    await bot.tick();
    const bot2 = new BotEngine({ provider, market, storage });
    await bot2.loadState();
    expect(bot2.config.symbols).toEqual(['UPUSDT']);
    expect(bot2.positions).toHaveLength(1);
  });
});

describe('PaperProvider', () => {
  it('applies the 0.1% taker fee and tracks the ledger', async () => {
    const paper = new PaperProvider(1000, () => 50);
    const buy = await paper.marketBuy('BTCUSDT', 100);
    // fee = 0.1 USDT → net spend 99.9 → qty = 99.9 / 50
    expect(buy.qty).toBeCloseTo(99.9 / 50, 10);
    const bal = await paper.getBalances();
    expect(bal.usdtFree).toBeCloseTo(900);
    expect(bal.assetFree.BTC).toBeCloseTo(99.9 / 50);
    const sell = await paper.marketSell('BTCUSDT', 99.9 / 50);
    expect(sell.proceedsUsdt).toBeCloseTo(99.9 * 0.999, 6);
    const bal2 = await paper.getBalances();
    expect(bal2.usdtFree).toBeCloseTo(900 + 99.9 * 0.999, 6);
  });

  it('rejects overspending', async () => {
    const paper = new PaperProvider(100, () => 1);
    await expect(paper.marketBuy('BTCUSDT', 500)).rejects.toThrow('insufficient');
  });
});
