import Big from 'big.js';
import { binanceRest } from '../api/binanceRest';
import { Trade, OrderRequest, TradePreview, TradeStats, PositionInfo } from '../types/trading';
import { Signal, SignalType } from '../types/signals';
import { AppSettings } from '../types/app';
import { BinanceSymbolInfo, BinanceOrder } from '../types/binance';
import { calculatePositionSize } from './positionSizer';
import { checkTradeRisk, checkSpreadLimit } from './riskManager';
import { roundQuantity, roundPrice, validateOrderQuantity, parseFilters, calculateStopLoss, calculateTakeProfit } from '../utils/quantityCalculator';
import { calculateFee, calculatePnl, calculatePnlPercentage } from '../utils/mathHelpers';
import { RISK_DEFAULTS } from '../utils/constants';

export class TradingEngine {
  private exchangeInfo: Map<string, BinanceSymbolInfo> = new Map();
  private isRunning: boolean = false;
  private settings: AppSettings | null = null;

  async initialize(settings: AppSettings): Promise<void> {
    this.settings = settings;
    binanceRest.configure(
      settings.apiKeyEncrypted || '',
      settings.apiSecretEncrypted || '',
      settings.isTestnet
    );
    await this.loadExchangeInfo();
    this.isRunning = true;
  }

  async loadExchangeInfo(): Promise<void> {
    try {
      const info = await binanceRest.getExchangeInfo();
      for (const symbol of info.symbols) {
        this.exchangeInfo.set(symbol.symbol, symbol);
      }
    } catch (error) {
      console.error('Failed to load exchange info:', error);
    }
  }

  getSymbolInfo(symbol: string): BinanceSymbolInfo | null {
    return this.exchangeInfo.get(symbol) || null;
  }

  async executeSignal(signal: Signal, settings: AppSettings, openTrades: Trade[], portfolioValue: number, dailyPnl: number, weeklyPnl: number, peakPortfolio: number, consecutiveLosses: number): Promise<{ success: boolean; trade?: Trade; error?: string }> {
    if (settings.isPaperTrade) {
      return this.executePaperTrade(signal, settings, portfolioValue);
    }

    if (!settings.apiKeyEncrypted || !settings.apiSecretEncrypted) {
      return { success: false, error: 'API credentials not configured' };
    }

    const riskCheck = checkTradeRisk(signal, settings, openTrades, portfolioValue, dailyPnl, weeklyPnl, peakPortfolio, consecutiveLosses, [], signal.priceAtSignal);
    if (!riskCheck.approved) {
      return { success: false, error: riskCheck.reason };
    }

    const symbolInfo = this.exchangeInfo.get(signal.symbol);
    if (!symbolInfo) {
      return { success: false, error: `Symbol ${signal.symbol} not found in exchange info` };
    }

    const side = this.signalToSide(signal.signalType);
    if (!side) {
      return { success: false, error: `Signal ${signal.signalType} is HOLD - no action` };
    }

    const balance = await binanceRest.getUSDTBalance();
    const posSize = calculatePositionSize(balance, signal.priceAtSignal, signal.priceAtSignal * (1 - settings.defaultSlPct / 100), side, settings.maxTradePct);
    const filters = parseFilters(symbolInfo.filters);
    const quantity = roundQuantity(posSize.quantity, filters.lotSize.stepSize);
    const price = roundPrice(signal.priceAtSignal, filters.priceFilter.tickSize);

    const validation = validateOrderQuantity(quantity, price, symbolInfo);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const order = await binanceRest.placeOrder({
        symbol: signal.symbol,
        side,
        type: 'MARKET',
        quantity,
      });

      const avgPrice = order.fills && order.fills.length > 0
        ? order.fills.reduce((sum, f) => sum + parseFloat(f.price) * parseFloat(f.qty), 0) /
          order.fills.reduce((sum, f) => sum + parseFloat(f.qty), 0)
        : parseFloat(order.price) || price;

      const sl = roundPrice(calculateStopLoss(avgPrice, 0, side, 2), filters.priceFilter.tickSize);
      const tp = roundPrice(calculateTakeProfit(avgPrice, sl, side, 2), filters.priceFilter.tickSize);

      await binanceRest.placeOrder({
        symbol: signal.symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY',
        type: 'STOP_LOSS_LIMIT',
        quantity,
        price: sl,
        stopPrice: sl,
        timeInForce: 'GTC',
      });

      await binanceRest.placeOrder({
        symbol: signal.symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY',
        type: 'TAKE_PROFIT_LIMIT',
        quantity,
        price: tp,
        stopPrice: tp,
        timeInForce: 'GTC',
      });

      const fee = order.fills
        ? order.fills.reduce((sum, f) => sum + parseFloat(f.commission), 0)
        : calculateFee(quantity, avgPrice, RISK_DEFAULTS.TAKER_FEE);

      const trade: Trade = {
        id: Date.now(),
        binanceOrderId: String(order.orderId),
        symbol: signal.symbol,
        side,
        orderType: 'MARKET',
        quantity,
        entryPrice: avgPrice,
        exitPrice: null,
        totalValue: quantity * avgPrice,
        status: 'OPEN',
        stopLoss: sl,
        takeProfit: tp,
        trailingStop: null,
        trailingStopActivated: false,
        breakevenActivated: false,
        feePaid: fee,
        grossPnl: null,
        netPnl: null,
        pnlPercentage: null,
        signalId: signal.id,
        strategyUsed: settings.strategy,
        isPaperTrade: false,
        durationSeconds: null,
        exitReason: null,
        notes: null,
        openedAt: new Date().toISOString(),
        closedAt: null,
      };

      return { success: true, trade };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private executePaperTrade(signal: Signal, settings: AppSettings, portfolioValue: number): { success: boolean; trade: Trade } {
    const side = this.signalToSide(signal.signalType) || 'BUY';
    const posSize = calculatePositionSize(portfolioValue, signal.priceAtSignal, signal.priceAtSignal * (1 - settings.defaultSlPct / 100), side, settings.maxTradePct);
    const fee = calculateFee(posSize.quantity, signal.priceAtSignal, RISK_DEFAULTS.TAKER_FEE);

    const trade: Trade = {
      id: Date.now(),
      binanceOrderId: `paper_${Date.now()}`,
      symbol: signal.symbol,
      side,
      orderType: 'MARKET',
      quantity: posSize.quantity,
      entryPrice: signal.priceAtSignal,
      exitPrice: null,
      totalValue: posSize.dollarAmount,
      status: 'OPEN',
      stopLoss: calculateStopLoss(signal.priceAtSignal, 0, side, 2),
      takeProfit: calculateTakeProfit(signal.priceAtSignal, calculateStopLoss(signal.priceAtSignal, 0, side, 2), side, 2),
      trailingStop: null,
      trailingStopActivated: false,
      breakevenActivated: false,
      feePaid: fee,
      grossPnl: null,
      netPnl: null,
      pnlPercentage: null,
      signalId: signal.id,
      strategyUsed: settings.strategy,
      isPaperTrade: true,
      durationSeconds: null,
      exitReason: null,
      notes: null,
      openedAt: new Date().toISOString(),
      closedAt: null,
    };

    return { success: true, trade };
  }

  async closeTrade(trade: Trade, currentPrice: number, reason: string): Promise<Trade> {
    const closedTrade = { ...trade };
    closedTrade.exitPrice = currentPrice;
    closedTrade.status = 'CLOSED';
    closedTrade.closedAt = new Date().toISOString();
    closedTrade.exitReason = reason;
    closedTrade.grossPnl = calculatePnl(trade.entryPrice, currentPrice, trade.quantity, trade.side);
    closedTrade.netPnl = closedTrade.grossPnl - trade.feePaid;
    closedTrade.pnlPercentage = calculatePnlPercentage(trade.entryPrice, currentPrice, trade.side);
    closedTrade.durationSeconds = Math.floor((Date.now() - new Date(trade.openedAt).getTime()) / 1000);

    if (!trade.isPaperTrade) {
      try {
        await binanceRest.cancelAllOpenOrders(trade.symbol);
        await binanceRest.placeOrder({
          symbol: trade.symbol,
          side: trade.side === 'BUY' ? 'SELL' : 'BUY',
          type: 'MARKET',
          quantity: trade.quantity,
        });
      } catch (error) {
        console.error('Error closing live trade:', error);
      }
    }

    return closedTrade;
  }

  async emergencyCloseAll(trades: Trade[]): Promise<Trade[]> {
    const closedTrades: Trade[] = [];
    for (const trade of trades) {
      if (trade.status === 'OPEN') {
        try {
          const closed = await this.closeTrade(trade, trade.entryPrice, 'EMERGENCY_CLOSE');
          closedTrades.push(closed);
        } catch (error) {
          console.error(`Failed to close trade ${trade.id}:`, error);
        }
      }
    }
    return closedTrades;
  }

  async cancelAllOrders(): Promise<void> {
    try {
      const openOrders = await binanceRest.getOpenOrders();
      for (const order of openOrders) {
        await binanceRest.cancelOrder(order.symbol, order.orderId);
      }
    } catch (error) {
      console.error('Failed to cancel all orders:', error);
    }
  }

  checkStopLoss(trade: Trade, currentPrice: number): boolean {
    if (trade.side === 'BUY') return currentPrice <= trade.stopLoss;
    return currentPrice >= trade.stopLoss;
  }

  checkTakeProfit(trade: Trade, currentPrice: number): boolean {
    if (trade.side === 'BUY') return currentPrice >= trade.takeProfit;
    return currentPrice <= trade.takeProfit;
  }

  checkTrailingStop(trade: Trade, currentPrice: number): { triggered: boolean; newStopPrice: number | null } {
    if (!trade.trailingStop && !this.settings?.trailingStopPct) {
      return { triggered: false, newStopPrice: null };
    }

    const trailingPct = this.settings?.trailingStopPct || RISK_DEFAULTS.TRAILING_STOP_PCT;
    const activatePct = RISK_DEFAULTS.TRAILING_ACTIVATE_PCT;
    const profitPct = trade.side === 'BUY'
      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

    if (profitPct < activatePct) {
      return { triggered: false, newStopPrice: null };
    }

    const trailAmount = currentPrice * (trailingPct / 100);
    const newStop = trade.side === 'BUY' ? currentPrice - trailAmount : currentPrice + trailAmount;

    if (trade.trailingStop) {
      const betterStop = trade.side === 'BUY' ? Math.max(trade.trailingStop, newStop) : Math.min(trade.trailingStop, newStop);
      if (trade.side === 'BUY' && currentPrice <= betterStop) return { triggered: true, newStopPrice: betterStop };
      if (trade.side === 'SELL' && currentPrice >= betterStop) return { triggered: true, newStopPrice: betterStop };
      return { triggered: false, newStopPrice: betterStop };
    }

    return { triggered: false, newStopPrice: newStop };
  }

  checkBreakeven(trade: Trade, currentPrice: number): boolean {
    const profitPct = trade.side === 'BUY'
      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
    return !trade.breakevenActivated && profitPct >= RISK_DEFAULTS.BREAKEVEN_ACTIVATE_PCT;
  }

  private signalToSide(signal: SignalType): 'BUY' | 'SELL' | null {
    if (['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(signal)) return 'BUY';
    if (['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(signal)) return 'SELL';
    return null;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  stop(): void {
    this.isRunning = false;
  }
}

export const tradingEngine = new TradingEngine();
