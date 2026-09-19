import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { tradingService } from './tradingService';
import { logger } from '../services/loggingService';

const BACKGROUND_FETCH_TASK = 'CryptoSignalBackgroundFetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    logger.info('Background fetch triggered');
    if (!tradingService.isActiveService()) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error: any) {
    logger.error(`Background fetch error: ${error.message}`);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundFetch = async (): Promise<boolean> => {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      logger.warn('Background fetch is denied by the system');
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    logger.info('Background fetch registered successfully');
    return true;
  } catch (error: any) {
    logger.error(`Failed to register background fetch: ${error.message}`);
    return false;
  }
};

export const unregisterBackgroundFetch = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      logger.info('Background fetch unregistered');
    }
  } catch (error: any) {
    logger.error(`Failed to unregister background fetch: ${error.message}`);
  }
};
