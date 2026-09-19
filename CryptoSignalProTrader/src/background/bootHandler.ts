import { Platform } from 'react-native';
import { logger } from '../services/loggingService';
import { getEngineState, saveEngineState } from '../services/databaseService';
import { tradingService } from './tradingService';
import { AppSettings } from '../types/app';

export const handleBootComplete = async (): Promise<void> => {
  try {
    logger.info('Boot completed handler triggered');

    const autoStart = await getEngineState('auto_start_trading');
    if (autoStart === false) {
      logger.info('Auto-start disabled, skipping');
      return;
    }

    const savedSettings = await getEngineState('app_settings');
    if (!savedSettings) {
      logger.warn('No saved settings found, cannot auto-start');
      return;
    }

    const settings = savedSettings as AppSettings;
    if (!settings.autoStartOnBoot) {
      logger.info('Auto-start on boot disabled in settings');
      return;
    }

    logger.info('Auto-starting trading service after boot...');
    await tradingService.start(settings);
    logger.info('Trading service auto-started successfully after boot');
  } catch (error: any) {
    logger.error(`Boot handler error: ${error.message}`);
    setTimeout(handleBootComplete, 10000);
  }
};

export const setAutoStartOnBoot = async (enabled: boolean): Promise<void> => {
  await saveEngineState('auto_start_trading', enabled);
  logger.info(`Auto-start on boot ${enabled ? 'enabled' : 'disabled'}`);
};
