import { tradingService } from './tradingService';
import { logger } from '../services/loggingService';
import { getEngineState } from '../services/databaseService';
import { loadSettings } from '../store/slices/settingsSlice';
import { AppSettings } from '../types/app';

export const headlessTaskDefinition = {
  taskName: 'TradingBackgroundTask',
  task: async ({ data, error }: { data?: any; error?: any }) => {
    if (error) {
      logger.error(`Headless task error: ${error}`);
      return;
    }

    logger.info('Headless trading task started');

    try {
      const savedSettings = await getEngineState('app_settings');
      if (savedSettings) {
        const settings = savedSettings as AppSettings;
        if (!tradingService.isActiveService()) {
          await tradingService.start(settings);
        }
      }
    } catch (err: any) {
      logger.error(`Headless task failed: ${err.message}`);
    }
  },
};

export const startHeadlessTask = async (): Promise<void> => {
  try {
    logger.info('Starting headless trading task');
  } catch (error: any) {
    logger.error(`Failed to start headless task: ${error.message}`);
  }
};
