import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setBackgroundRunning, setActive } from '../store/slices/botSlice';
import { tradingService } from '../background/tradingService';
import { registerBackgroundFetch, unregisterBackgroundFetch } from '../background/backgroundTasks';
import { recoverFromCrash } from '../background/crashRecovery';
import { logger } from '../services/loggingService';

export const useBackgroundService = () => {
  const dispatch = useAppDispatch();
  const { isActive, isBackgroundRunning } = useAppSelector(state => state.bot);
  const { settings } = useAppSelector(state => state.settings);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        tradingService.setForeground(false);
        logger.info('App moved to background, switching trading intervals');
      } else if (nextState === 'active') {
        tradingService.setForeground(true);
        logger.info('App moved to foreground, switching trading intervals');
      }
    });

    return () => subscription.remove();
  }, []);

  const startBot = useCallback(async () => {
    try {
      await tradingService.start(settings);
      await registerBackgroundFetch();
      dispatch(setActive(true));
      dispatch(setBackgroundRunning(true));
      logger.info('Bot started');
    } catch (error: any) {
      logger.error(`Failed to start bot: ${error.message}`);
    }
  }, [dispatch, settings]);

  const stopBot = useCallback(async () => {
    tradingService.stop();
    await unregisterBackgroundFetch();
    dispatch(setActive(false));
    dispatch(setBackgroundRunning(false));
    logger.info('Bot stopped');
  }, [dispatch]);

  const toggleBot = useCallback(async () => {
    if (isActive) {
      await stopBot();
    } else {
      await startBot();
    }
  }, [isActive, startBot, stopBot]);

  const emergencyStop = useCallback(async () => {
    await tradingService.emergencyCloseAll();
    await stopBot();
  }, [stopBot]);

  return {
    isActive,
    isBackgroundRunning,
    startBot,
    stopBot,
    toggleBot,
    emergencyStop,
  };
};
