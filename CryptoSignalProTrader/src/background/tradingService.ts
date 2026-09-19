import { AppState, Platform } from 'react-native';
import { binanceRest } from '../api/binanceRest';
import { binanceWs, WsEvent } from '../api/binanceWebSocket';
import { generateSignal, buildTimeframeAlignment } from '../engine/signalEngine';
import { tradingEngine } from '../engine/tradingEngine';
import { checkFlashCrash, checkTradeRisk } from '../engine/riskManager';
import { Signal, SignalType, Timeframe } from '../types/signals';
import { Trade } from '../types/trading';
import { AppSettings } from '../types/app';
import { BinanceKline } from '../types/binance';
import { WS_STREAMS } from '../api/endpoints';
import { FOREGROUND_INTERVALS, BACKGROUND_INTERVALS, KLINE_INTERVALS } from '../utils/constants';
import { saveTrade, getOpenTrades, saveSignal, saveEngineState, getEngineState, addLog, getDailyPnl } from '../services/databaseService';
import { sendTradeNotification, sendSignalNotification, sendPanicNotification } from '../services/notificationService';
import { telegramService } from '../services/telegramService';
import { logger } from '../services/loggingService';

type Intervals = typeof FOREGROUND_INTERVALS;

class TradingService {
  private isActive: boolean = false;
  private settings: AppSettings | null = null;
  private intervals: Record<string, ReturnType<typeof setInterval>> = {};
  private isForeground: boolean = true;
  private lastPrices: Map<string, number[]> = new Map();
  private recentLossTimestamps: Map<string, number[]> = new Map();

  async start(settings: AppSettings): Promise<void> {
    if (this.isActive) return;
    this.settings = settings;
    this.isActive = true;

    logger.info('Trading service starting...');
    binanceRest.configure(settings.apiKeyEncrypted || '', settings.apiSecretEncrypted || '', settings.isTestnet);

    await tradingEngine.initialize(settings);
    this.setupWebSocket(settings);
    this.startIntervals();
    this.saveState();

    logger.info('Trading service started successfully');
  }

  stop(): void {
    this.isActive = false;
    Object.values(this.intervals).forEach(clearInterval);
    this.intervals = {};
    binanceWs.disconnect();
    logger.info('Trading service stopped');
  }

  private setupWebSocket(settings: AppSettings): void {
    binanceWs.configure(settings.isTestnet);
    const streams: string[] = [];
    for (const symbol of this.getActivePairs()) {
      streams.push(WS_STREAMS.ticker(symbol));
      streams.push(WS_STREAMS.kline(symbol, '5m'));
      streams.push(WS_STREAMS.kline(symbol, '15m'));
      streams.push(WS_STREAMS.kline(symbol, '1h'));
    }
    binanceWs.connect(streams);

    binanceWs.on('ticker', (event: WsEvent) => {
      if (event.symbol && event.data) {
        const price = parseFloat(event.data.c);
        this.updatePriceHistory(event.symbol, price);
      }
    });

    binanceWs.on('kline', (event: WsEvent) => {
      if (event.data?.x) {
        this.checkSignalsForPair(event.symbol!);
      }
    });

    binanceWs.on('disconnected', () => {
      logger.warn('WebSocket disconnected, will auto-reconnect');
    });
  }

  private getActivePairs(): string[] {
    return this.settings?.strategy ? ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'] : ['BTCUSDT'];
  }

  private startIntervals(): void {
    const intervals = this.isForeground ? FOREGROUND_INTERVALS : BACKGROUND_INTERVALS;

    this.intervals.signalScan = setInterval(() => this.scanAllPairs(), intervals.SIGNAL_SCAN);
    this.intervals.priceCheck = setInterval(() => this.checkOpenTrades(), intervals.PRICE_CHECK);
    this.intervals.riskCheck = setInterval(() => this.runRiskChecks(), intervals.RISK_CHECK);
    this.intervals.portfolioSync = setInterval(() => this.syncPortfolio(), intervals.PORTFOLIO_SYNC);
    this.intervals.orderCheck = setInterval(() => this.checkOrderStatus(), intervals.ORDER_CHECK);
    this.intervals.stateSave = setInterval(() => this.saveState(), intervals.STATE_SAVE);
  }

  setForeground(isForeground: boolean): void {
    if (this.isForeground === isForeground) return;
    this.isForeground = isForeground;
    Object.values(this.intervals).forEach(clearInterval);
    this.intervals = {};
    this.startIntervals();
    logger.info(`Switched to ${isForeground ? 'foreground' : 'background'} mode`);
  }

  private async scanAllPairs(): Promise<void> {
    if (!this.isActive || !this.settings) return;
    const pairs = this.getActivePairs();
    for (const symbol of pairs) {
      try {
        await this.checkSignalsForPair(symbol);
      } catch (error: any) {
        logger.error(`Signal scan error for ${symbol}: ${error.message}`);
      }
    }
  }

  private async checkSignalsForPair(symbol: string): Promise<void> {
    if (!this.settings) return;
    try {
      const klines = await binanceRest.getKlines(symbol, '5m', 200);
      if (klines.length < 60) return;

      const signalBreakdown = generateSignal(klines, '5m');
      const signal: Signal = {
        id: Date.now(),
        symbol,
        signalType: signalBreakdown.signalType,
        score: signalBreakdown.totalScore,
        confidence: signalBreakdown.confidence,
        marketRegime: signalBreakdown.marketRegime,
        rsiValue: signalBreakdown.indicators[0]?.value || 0,
        macdValue: signalBreakdown.indicators[1]?.value || 0,
        macdSignal: 0,
        macdHistogram: 0,
        bbUpper: 0,
        bbLower: 0,
        bbPercent: 0,
        ema9: 0,
        ema21: 0,
        ema50: 0,
        stochRsiK: 0,
        stochRsiD: 0,
        atrValue: 0,
        adxValue: 0,
        volumeRatio: 1,
        timeframe: '5m',
        priceAtSignal: parseFloat(klines[klines.length - 1].close),
        wasActedOn: false,
        outcome: null,
        outcomePnl: null,
        createdAt: new Date().toISOString(),
        multiTimeframeAlignment: { '1m': null, '5m': signalBreakdown.signalType, '15m': null, '1h': null, '4h': null, '1d': null, alignmentScore: 0, confirmingTimeframes: 1 },
      };

      await saveSignal(signal);

      const isActionable = ['STRONG_BUY', 'BUY', 'STRONG_SELL', 'SELL'].includes(signal.signalType);
      if (isActionable && signal.confidence >= this.settings.minConfidence) {
        await sendSignalNotification(symbol, signal.signalType, signal.confidence, signal.priceAtSignal);

        if (this.settings.isAutoTrade) {
          const openTrades = await getOpenTrades();
          const portfolioValue = this.settings.maxTradePct * 1000;
          const dailyPnl = await getDailyPnl();
          const result = await tradingEngine.executeSignal(
            signal, this.settings, openTrades, portfolioValue,
            dailyPnl, 0, portfolioValue, 0
          );
          if (result.success && result.trade) {
            await saveTrade(result.trade);
            await sendTradeNotification(symbol, result.trade.side, result.trade.entryPrice);
            telegramService.sendTradeAlert(result.trade, signal.confidence);
          }
        }
      }
    } catch (error: any) {
      logger.error(`Signal check failed for ${symbol}: ${error.message}`);
    }
  }

  private async checkOpenTrades(): Promise<void> {
    if (!this.settings) return;
    try {
      const openTrades = await getOpenTrades();
      for (const trade of openTrades) {
        const priceData = await binanceRest.getTickerPrice(trade.symbol);
        const currentPrice = Array.isArray(priceData) ? parseFloat(priceData[0].price) : parseFloat((priceData as any).price);

        if (tradingEngine.checkStopLoss(trade, currentPrice)) {
          const closed = await tradingEngine.closeTrade(trade, currentPrice, 'STOP_LOSS');
          await saveTrade(closed);
          await sendTradeNotification(trade.symbol, trade.side, currentPrice, closed.netPnl || 0);
          continue;
        }

        if (tradingEngine.checkTakeProfit(trade, currentPrice)) {
          const closed = await tradingEngine.closeTrade(trade, currentPrice, 'TAKE_PROFIT');
          await saveTrade(closed);
          await sendTradeNotification(trade.symbol, trade.side, currentPrice, closed.netPnl || 0);
          continue;
        }

        const trailingResult = tradingEngine.checkTrailingStop(trade, currentPrice);
        if (trailingResult.triggered) {
          const closed = await tradingEngine.closeTrade(trade, currentPrice, 'TRAILING_STOP');
          await saveTrade(closed);
          await sendTradeNotification(trade.symbol, trade.side, currentPrice, closed.netPnl || 0);
        } else if (trailingResult.newStopPrice && trailingResult.newStopPrice !== trade.trailingStop) {
          trade.trailingStop = trailingResult.newStopPrice;
          await saveTrade(trade);
        }

        if (tradingEngine.checkBreakeven(trade, currentPrice)) {
          trade.stopLoss = trade.entryPrice;
          trade.breakevenActivated = true;
          await saveTrade(trade);
        }
      }
    } catch (error: any) {
      logger.error(`Trade check error: ${error.message}`);
    }
  }

  private async runRiskChecks(): Promise<void> {
    if (!this.settings) return;
    try {
      const openTrades = await getOpenTrades();
      for (const symbol of this.getActivePairs()) {
        const prices = this.lastPrices.get(symbol) || [];
        if (prices.length > 2) {
          const isFlashCrash = checkFlashCrash(prices.slice(-60));
          if (isFlashCrash) {
            logger.warn(`Flash crash detected on ${symbol}!`);
            const affectedTrades = openTrades.filter(t => t.symbol === symbol);
            for (const trade of affectedTrades) {
              const closed = await tradingEngine.closeTrade(trade, prices[prices.length - 1], 'FLASH_CRASH');
              await saveTrade(closed);
            }
            await sendPanicNotification(`Flash crash detected on ${symbol}`);
          }
        }
      }
    } catch (error: any) {
      logger.error(`Risk check error: ${error.message}`);
    }
  }

  private async syncPortfolio(): Promise<void> {
    if (!this.settings || this.settings.isPaperTrade) return;
    try {
      const account = await binanceRest.getAccount();
      const usdtBalance = account.balances.find(b => b.asset === 'USDT');
      if (usdtBalance) {
        await saveEngineState('portfolio_balance', parseFloat(usdtBalance.free));
      }
    } catch (error: any) {
      logger.error(`Portfolio sync error: ${error.message}`);
    }
  }

  private async checkOrderStatus(): Promise<void> {
    if (!this.settings || this.settings.isPaperTrade) return;
    try {
      const openTrades = await getOpenTrades();
      for (const trade of openTrades) {
        if (!trade.binanceOrderId.startsWith('paper_')) {
          const order = await binanceRest.getOrderStatus(trade.symbol, parseInt(trade.binanceOrderId));
          if (order.status === 'FILLED') {
            // Order completed
          } else if (order.status === 'CANCELED' || order.status === 'REJECTED') {
            trade.status = 'CANCELLED';
            trade.exitReason = order.status;
            await saveTrade(trade);
          }
        }
      }
    } catch (error: any) {
      logger.error(`Order check error: ${error.message}`);
    }
  }

  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.lastPrices.has(symbol)) {
      this.lastPrices.set(symbol, []);
    }
    const prices = this.lastPrices.get(symbol)!;
    prices.push(price);
    if (prices.length > 600) {
      prices.splice(0, prices.length - 600);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await saveEngineState('service_status', {
        isActive: this.isActive,
        uptime: Date.now(),
        activePairs: this.getActivePairs(),
        lastSave: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`State save error: ${error.message}`);
    }
  }

  async emergencyCloseAll(): Promise<void> {
    try {
      const openTrades = await getOpenTrades();
      await tradingEngine.emergencyCloseAll(openTrades);
      await tradingEngine.cancelAllOrders();
      await sendPanicNotification('User activated panic button');
      logger.warn('Emergency close all executed');
    } catch (error: any) {
      logger.fatal(`Emergency close failed: ${error.message}`);
    }
  }

  isActiveService(): boolean {
    return this.isActive;
  }
}

export const tradingService = new TradingService();
