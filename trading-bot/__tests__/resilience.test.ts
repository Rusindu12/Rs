import { shouldEnter, TRADE_MODE_FLOOR } from '../src/engine/types';
import { BinanceRest } from '../src/services/binance/rest';

describe('trade-mode entry gate (why-is-it-not-trading fix)', () => {
  it('chill mode requires an action-grade BUY signal', () => {
    expect(shouldEnter(45, 'BUY', 'chill', 'BUY')).toBe(true);
    expect(shouldEnter(25, 'HOLD', 'chill', 'BUY')).toBe(false);
    expect(shouldEnter(75, 'STRONG_BUY', 'chill', 'STRONG_BUY')).toBe(true);
    expect(shouldEnter(45, 'BUY', 'chill', 'STRONG_BUY')).toBe(false);
  });

  it('normal mode opens from score ≥ 20 even on bullish HOLD', () => {
    expect(shouldEnter(20, 'HOLD', 'normal', 'BUY')).toBe(true);
    expect(shouldEnter(19.9, 'HOLD', 'normal', 'BUY')).toBe(false);
    expect(shouldEnter(35, 'BUY', 'normal', 'BUY')).toBe(true);
  });

  it('turbo mode opens from score ≥ 8', () => {
    expect(shouldEnter(8, 'HOLD', 'turbo', 'BUY')).toBe(true);
    expect(shouldEnter(7.9, 'HOLD', 'turbo', 'BUY')).toBe(false);
  });

  it('never enters on sell-side signals in any mode', () => {
    expect(shouldEnter(-50, 'SELL', 'turbo', 'BUY')).toBe(false);
    expect(shouldEnter(-70, 'STRONG_SELL', 'normal', 'BUY')).toBe(false);
  });

  it('floors are ordered chill > normal > turbo', () => {
    expect(TRADE_MODE_FLOOR.chill).toBeGreaterThan(TRADE_MODE_FLOOR.normal);
    expect(TRADE_MODE_FLOOR.normal).toBeGreaterThan(TRADE_MODE_FLOOR.turbo);
  });
});

describe('Binance REST host failover', () => {
  const realFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  afterEach(() => {
    (globalThis as { fetch?: typeof fetch }).fetch = realFetch;
  });

  it('falls back to the mirror host when api.binance.com is unreachable', async () => {
    const rest = new BinanceRest('', '', 'live');
    const calls: string[] = [];
    (globalThis as { fetch?: typeof fetch }).fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('https://api.binance.com')) throw new TypeError('Network request failed');
      return {
        ok: true,
        json: async () => [
          [1700000000000, '1', '2', '0.5', '1.5', '10', 1700000899999, '15', 3, '0', '0', '0'],
        ],
      } as unknown as Response;
    }) as typeof fetch;

    const rows = await rest.klines('BTCUSDT', '15m', 1);
    expect(rows).toHaveLength(1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]).toContain('api.binance.com');
    expect(rest.activePublicBase).not.toBe('https://api.binance.com');
    // second call goes straight to the remembered host
    calls.length = 0;
    await rest.klines('ETHUSDT', '15m', 1);
    expect(calls[0]).not.toContain('api.binance.com');
  }, 20_000);
});

describe('exit paths — every BUY is eventually SOLD', () => {
  const pos = { stopLoss: 98, takeProfit: 104, openedAt: 0 } as any;

  it('closes early when the AI flips bearish (score ≤ −20)', () => {
    const { checkExit } = require('../src/engine/riskManager');
    expect(checkExit(pos, 100, 'HOLD', { score: -20 }).reason).toBe('SIGNAL_FLIP');
    expect(checkExit(pos, 100, 'HOLD', { score: -19.9 }).exit).toBe(false);
    expect(checkExit(pos, 100, 'HOLD', { score: 5 }).exit).toBe(false);
  });

  it('time-stops positions held beyond maxHold', () => {
    const { checkExit } = require('../src/engine/riskManager');
    const h8 = 8 * 3_600_000;
    expect(checkExit(pos, 100, 'HOLD', { heldMs: h8, maxHoldMs: h8 }).reason).toBe('MAX_HOLD');
    expect(checkExit(pos, 100, 'HOLD', { heldMs: h8 - 1, maxHoldMs: h8 }).exit).toBe(false);
    expect(checkExit(pos, 100, 'HOLD', { heldMs: h8, maxHoldMs: 0 }).exit).toBe(false); // 0 = disabled
  });

  it('keeps SL/TP as the first-priority exits', () => {
    const { checkExit } = require('../src/engine/riskManager');
    expect(checkExit(pos, 97, 'HOLD', { score: -50 }).reason).toBe('STOP_LOSS');
    expect(checkExit(pos, 105, 'HOLD', { score: -50 }).reason).toBe('TAKE_PROFIT');
  });
});
