import axios from 'axios';
import { Trade } from '../types/trading';
import { formatPairName, formatCurrency, formatPercentage, formatPnl } from '../utils/priceFormatter';

const BASE_URL = 'https://api.telegram.org/bot';

class TelegramService {
  private botToken: string = '';
  private chatId: string = '';
  private isEnabled: boolean = false;

  configure(botToken: string, chatId: string): void {
    this.botToken = botToken;
    this.chatId = chatId;
    this.isEnabled = Boolean(botToken && chatId);
  }

  async sendMessage(text: string, parseMode: string = 'HTML'): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      await axios.post(`${BASE_URL}${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
      });
      return true;
    } catch (error: any) {
      console.error('Telegram send error:', error.message);
      return false;
    }
  }

  async sendTradeAlert(trade: Trade, signalConfidence?: number): Promise<boolean> {
    const emoji = trade.side === 'BUY' ? '✅' : '🔴';
    const signal = trade.side === 'BUY' ? 'BUY' : 'SELL';
    const text = [
      `${emoji} <b>${signal} ${formatPairName(trade.symbol)}</b>`,
      `💰 Entry: <code>$${trade.entryPrice.toFixed(2)}</code>`,
      `📊 Qty: <code>${trade.quantity.toFixed(6)}</code>`,
      `🛡 SL: <code>$${trade.stopLoss.toFixed(2)}</code>`,
      `🎯 TP: <code>$${trade.takeProfit.toFixed(2)}</code>`,
      signalConfidence ? `📈 Confidence: <b>${signalConfidence.toFixed(0)}%</b>` : '',
      `📋 Mode: ${trade.isPaperTrade ? '📝 Paper' : '🔴 LIVE'}`,
    ].filter(Boolean).join('\n');
    return this.sendMessage(text);
  }

  async sendPnlUpdate(trade: Trade, currentPrice: number): Promise<boolean> {
    if (!trade.exitPrice && !currentPrice) return false;
    const price = trade.exitPrice || currentPrice;
    const pnl = (price - trade.entryPrice) * trade.quantity * (trade.side === 'BUY' ? 1 : -1);
    const emoji = pnl >= 0 ? '📈' : '📉';
    const text = [
      `${emoji} <b>${formatPairName(trade.symbol)} Update</b>`,
      `💰 Current: <code>$${price.toFixed(2)}</code>`,
      `📊 PnL: <b>${formatPnl(pnl)}</b> (${formatPercentage(((price - trade.entryPrice) / trade.entryPrice) * 100 * (trade.side === 'BUY' ? 1 : -1))})`,
    ].join('\n');
    return this.sendMessage(text);
  }

  async sendDailySummary(stats: { totalTrades: number; winRate: number; pnl: number; portfolioValue: number }): Promise<boolean> {
    const emoji = stats.pnl >= 0 ? '✅' : '❌';
    const text = [
      `${emoji} <b>Daily Trading Summary</b>`,
      `📊 Trades: <b>${stats.totalTrades}</b>`,
      `🏆 Win Rate: <b>${stats.winRate.toFixed(1)}%</b>`,
      `💰 PnL: <b>${formatPnl(stats.pnl)}</b>`,
      `🏦 Portfolio: <b>${formatCurrency(stats.portfolioValue)}</b>`,
    ].join('\n');
    return this.sendMessage(text);
  }

  async sendPanicAlert(reason: string): Promise<boolean> {
    const text = [
      `🚨🚨🚨 <b>PANIC ALERT</b> 🚨🚨🚨`,
      `⚠️ All positions have been closed!`,
      `📝 Reason: <b>${reason}</b>`,
      `⏰ Time: <code>${new Date().toLocaleString()}</code>`,
    ].join('\n');
    return this.sendMessage(text);
  }

  async sendErrorAlert(error: string): Promise<boolean> {
    const text = [
      `🔴 <b>System Error</b>`,
      `❌ Error: <code>${error}</code>`,
      `⏰ Time: <code>${new Date().toLocaleString()}</code>`,
    ].join('\n');
    return this.sendMessage(text);
  }

  async testConnection(): Promise<{ success: boolean; botInfo?: any; error?: string }> {
    try {
      const response = await axios.get(`${BASE_URL}${this.botToken}/getMe`);
      return { success: true, botInfo: response.data.result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  isActive(): boolean {
    return this.isEnabled;
  }
}

export const telegramService = new TelegramService();
