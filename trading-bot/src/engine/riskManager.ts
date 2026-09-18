import { MIN_NOTIONAL_USDT } from '../config';
import type { BotConfig, Position } from './types';

export interface RiskDecision {
  allowed: boolean;
  reason: string;
  sizeUsdt: number;
}

/**
 * Pre-trade risk gate: position sizing, exposure limits, daily loss circuit
 * breaker and Binance minimum-notional compliance.
 */
export function checkEntryRisk(params: {
  config: BotConfig;
  positions: Position[];
  symbol: string;
  freeUsdt: number;
  realizedPnlTodayUsdt: number;
  equityUsdt: number;
}): RiskDecision {
  const { config, positions, symbol, freeUsdt, realizedPnlTodayUsdt, equityUsdt } = params;

  if (positions.some((p) => p.symbol === symbol)) {
    return { allowed: false, reason: 'position already open for this symbol', sizeUsdt: 0 };
  }
  if (positions.length >= config.maxOpenTrades) {
    return { allowed: false, reason: `max open trades reached (${config.maxOpenTrades})`, sizeUsdt: 0 };
  }

  // Daily loss circuit breaker — stop opening new risk while bleeding.
  if (equityUsdt > 0 && realizedPnlTodayUsdt < 0) {
    const lossPct = (-realizedPnlTodayUsdt / equityUsdt) * 100;
    if (lossPct >= config.dailyLossLimitPct) {
      return {
        allowed: false,
        reason: `daily loss limit hit (${lossPct.toFixed(1)}% ≥ ${config.dailyLossLimitPct}%)`,
        sizeUsdt: 0,
      };
    }
  }

  const size = Math.min(config.tradeAmountUsdt, freeUsdt);
  if (size < MIN_NOTIONAL_USDT) {
    return {
      allowed: false,
      reason: `insufficient USDT (need ≥ $${MIN_NOTIONAL_USDT} notional, have $${freeUsdt.toFixed(2)})`,
      sizeUsdt: 0,
    };
  }
  return { allowed: true, reason: 'ok', sizeUsdt: size };
}

/** Exit checks for an open position, evaluated on every engine tick. */
export type ExitReason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL_EXIT' | 'SIGNAL_FLIP' | 'MAX_HOLD' | null;

export interface ExitContext {
  /** Current AI composite score — a flip to ≤ −20 closes the position early. */
  score?: number;
  /** How long the position has been held (ms). */
  heldMs?: number;
  /** Time stop: close after this many ms held (0/null = never). */
  maxHoldMs?: number | null;
}

export function checkExit(
  position: Position,
  price: number,
  action: string,
  ctx?: ExitContext
): { exit: boolean; reason: ExitReason } {
  if (price <= position.stopLoss) return { exit: true, reason: 'STOP_LOSS' };
  if (price >= position.takeProfit) return { exit: true, reason: 'TAKE_PROFIT' };
  if (action === 'SELL' || action === 'STRONG_SELL') return { exit: true, reason: 'SIGNAL_EXIT' };
  if (ctx?.score != null && ctx.score <= -20) return { exit: true, reason: 'SIGNAL_FLIP' };
  if (ctx?.maxHoldMs != null && ctx.maxHoldMs > 0 && ctx.heldMs != null && ctx.heldMs >= ctx.maxHoldMs) {
    return { exit: true, reason: 'MAX_HOLD' };
  }
  return { exit: false, reason: null };
}

export function unrealizedPnl(position: Position, price: number): { usdt: number; pct: number } {
  const usdt = (price - position.entryPrice) * position.qty;
  const cost = position.entryPrice * position.qty;
  return { usdt, pct: cost > 0 ? (usdt / cost) * 100 : 0 };
}
