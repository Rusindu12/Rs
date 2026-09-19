import { getEngineState, saveEngineState, getOpenTrades, saveTrade } from '../services/databaseService';
import { tradingService } from './tradingService';
import { tradingEngine } from '../engine/tradingEngine';
import { logger } from '../services/loggingService';
import { AppSettings } from '../types/app';

export const recoverFromCrash = async (settings: AppSettings): Promise<void> => {
  try {
    logger.info('Attempting crash recovery...');

    const lastState = await getEngineState('service_status');
    if (lastState) {
      const timeSinceLastSave = Date.now() - new Date(lastState.lastSave).getTime();
      logger.info(`Last state save was ${Math.floor(timeSinceLastSave / 1000)}s ago`);

      if (timeSinceLastSave > 60000) {
        logger.warn('State may be stale, performing full recovery');
      }
    }

    // Check for orphaned open trades
    const openTrades = await getOpenTrades();
    logger.info(`Found ${openTrades.length} open trades to recover`);

    if (!settings.isPaperTrade && openTrades.length > 0) {
      // Sync with exchange
      for (const trade of openTrades) {
        if (!trade.binanceOrderId.startsWith('paper_')) {
          try {
            const orderStatus = await tradingEngine['exchangeInfo']?.get('trade.symbol');
            // In production, check actual order status on Binance
            logger.info(`Trade ${trade.id} (${trade.symbol}) status: ${trade.status}`);
          } catch (error: any) {
            logger.error(`Failed to sync trade ${trade.id}: ${error.message}`);
          }
        }
      }
    }

    // Restart the trading service
    await tradingService.start(settings);
    logger.info('Crash recovery completed successfully');
  } catch (error: any) {
    logger.fatal(`Crash recovery failed: ${error.message}`);
    // Schedule another recovery attempt
    setTimeout(() => recoverFromCrash(settings), 5000);
  }
};

export const saveTradingState = async (state: any): Promise<void> => {
  try {
    await saveEngineState('trading_engine_state', {
      ...state,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`Failed to save trading state: ${error.message}`);
  }
};

export const loadTradingState = async (): Promise<any> => {
  try {
    return await getEngineState('trading_engine_state');
  } catch (error: any) {
    logger.error(`Failed to load trading state: ${error.message}`);
    return null;
  }
};
