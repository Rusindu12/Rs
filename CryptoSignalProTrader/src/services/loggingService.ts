import { addLog } from './databaseService';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

class LoggingService {
  private isDebugMode: boolean = false;

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
  }

  debug(message: string, details?: any): void {
    if (this.isDebugMode) {
      console.log(`[DEBUG] ${message}`, details || '');
    }
  }

  info(message: string, details?: any): void {
    console.log(`[INFO] ${message}`, details || '');
    this.persistLog('info', message, details);
  }

  warn(message: string, details?: any): void {
    console.warn(`[WARN] ${message}`, details || '');
    this.persistLog('warn', message, details);
  }

  error(message: string, details?: any): void {
    console.error(`[ERROR] ${message}`, details || '');
    this.persistLog('error', message, details);
  }

  fatal(message: string, details?: any): void {
    console.error(`[FATAL] ${message}`, details || '');
    this.persistLog('fatal', message, details);
  }

  private async persistLog(level: LogLevel, message: string, details?: any): Promise<void> {
    try {
      const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : undefined;
      await addLog(level, message, detailsStr);
    } catch {
      // Silently fail to avoid infinite loops
    }
  }

  logTradeAction(action: string, trade: any): void {
    this.info(`Trade ${action}: ${trade.symbol} ${trade.side} ${trade.quantity} @ ${trade.entryPrice}`);
  }

  logSignal(symbol: string, signal: string, confidence: number, score: number): void {
    this.info(`Signal: ${symbol} ${signal} (${confidence.toFixed(1)}%, score: ${score.toFixed(1)})`);
  }

  logRiskCheck(approved: boolean, reason: string): void {
    if (approved) {
      this.info(`Risk check PASSED: ${reason}`);
    } else {
      this.warn(`Risk check FAILED: ${reason}`);
    }
  }

  logApiError(endpoint: string, error: string): void {
    this.error(`API Error [${endpoint}]: ${error}`);
  }

  logBackgroundEvent(event: string, details?: any): void {
    this.info(`Background: ${event}`, details);
  }

  logCrash(error: Error, context?: string): void {
    this.fatal(`Crash${context ? ` in ${context}` : ''}: ${error.message}\nStack: ${error.stack}`);
  }
}

export const logger = new LoggingService();
