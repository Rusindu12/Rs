import type { Balances, TradingProvider } from './types';
import type { BinanceRest } from '../services/binance/rest';

/**
 * Two implementations of the `TradingProvider` port:
 *
 *  • PaperProvider — simulated fills at the live market price with a 0.1%
 *    taker fee and a local USDT ledger. Default mode; no real funds at risk.
 *  • LiveProvider — real market orders on Binance (spot).
 */

const TAKER_FEE = 0.001;

export class PaperProvider implements TradingProvider {
  mode = 'paper' as const;

  private usdtFree: number;
  assetFree: Record<string, number> = {};

  constructor(
    startingBalanceUsdt: number,
    private getPrice: (symbol: string) => number,
    restore?: { usdtFree: number; assetFree: Record<string, number> }
  ) {
    this.usdtFree = restore?.usdtFree ?? startingBalanceUsdt;
    this.assetFree = restore?.assetFree ?? {};
  }

  snapshotLedger(): { usdtFree: number; assetFree: Record<string, number> } {
    return { usdtFree: this.usdtFree, assetFree: { ...this.assetFree } };
  }

  async getBalances(): Promise<Balances> {
    let equity = this.usdtFree;
    for (const [asset, qty] of Object.entries(this.assetFree)) {
      const price = this.getPrice(`${asset}USDT`);
      equity += isFinite(price) ? qty * price : 0;
    }
    return { usdtFree: this.usdtFree, assetFree: { ...this.assetFree }, equityUsdt: equity };
  }

  async marketBuy(symbol: string, quoteQty: number): Promise<{ qty: number; price: number; feeUsdt: number }> {
    const price = this.requirePrice(symbol);
    if (quoteQty > this.usdtFree + 1e-9) throw new Error('paper: insufficient USDT');
    const fee = quoteQty * TAKER_FEE;
    const qty = (quoteQty - fee) / price;
    this.usdtFree -= quoteQty;
    const base = symbol.replace(/USDT$/, '');
    this.assetFree[base] = (this.assetFree[base] ?? 0) + qty;
    return { qty, price, feeUsdt: fee };
  }

  async marketSell(symbol: string, qty: number): Promise<{ price: number; proceedsUsdt: number; feeUsdt: number }> {
    const price = this.requirePrice(symbol);
    const base = symbol.replace(/USDT$/, '');
    const held = this.assetFree[base] ?? 0;
    // Robustness: never fail a demo exit. Sell what is actually held (restored
    // ledgers can drift from restored positions); if nothing is held, the
    // position still closes and PnL is estimated at the current price.
    const sellQty = Math.min(qty, Math.max(0, held));
    if (sellQty <= 1e-12) {
      return { price, proceedsUsdt: 0, feeUsdt: 0 };
    }
    const gross = sellQty * price;
    const fee = gross * TAKER_FEE;
    this.assetFree[base] = held - sellQty;
    this.usdtFree += gross - fee;
    return { price, proceedsUsdt: gross - fee, feeUsdt: fee };
  }

  async cancelAllOrders(): Promise<void> {
    /* paper engine has no resting orders */
  }

  private requirePrice(symbol: string): number {
    const p = this.getPrice(symbol);
    if (!isFinite(p) || p <= 0) throw new Error(`paper: no live price for ${symbol}`);
    return p;
  }
}

export class LiveProvider implements TradingProvider {
  mode = 'live' as const;

  constructor(private rest: BinanceRest) {}

  async getBalances(): Promise<Balances> {
    const acct = await this.rest.account();
    if (!acct.canTrade) throw new Error('account is not enabled for trading');
    const free: Record<string, number> = {};
    for (const b of acct.balances) {
      const total = Number(b.free) + Number(b.locked);
      if (total > 0) free[b.asset] = Number(b.free);
    }
    const usdtFree = free.USDT ?? 0;
    let equity = usdtFree;
    // Valuation of non-USDT balances happens in the caller (needs prices);
    // here we at least count USDT so risk checks work.
    return { usdtFree, assetFree: free, equityUsdt: equity };
  }

  async marketBuy(symbol: string, quoteQty: number) {
    return this.rest.marketBuy(symbol, quoteQty);
  }

  async marketSell(symbol: string, qty: number) {
    const res = await this.rest.marketSell(symbol, qty);
    return { price: res.price, proceedsUsdt: res.qty * res.price - res.feeUsdt, feeUsdt: res.feeUsdt };
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    await this.rest.cancelAllOrders(symbol);
  }

  async placeProtectiveOco(p: { symbol: string; qty: number; stopLoss: number; takeProfit: number }): Promise<string | null> {
    return this.rest.placeOco(p.symbol, p.qty, p.takeProfit, p.stopLoss);
  }

  async cancelProtectiveOco(symbol: string, orderListId: string): Promise<void> {
    await this.rest.cancelOco(symbol, orderListId);
  }

  async lastPrice(symbol: string): Promise<number> {
    return this.rest.lastPrice(symbol);
  }

  async openOrdersExt(): Promise<{ orderListId?: number }[]> {
    return this.rest.openOrders();
  }
}
