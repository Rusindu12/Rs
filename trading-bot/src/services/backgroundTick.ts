/**
 * Background trading tick (Android).
 *
 * Even when the app is swiped away, WorkManager wakes the bot every ≥15 min
 * so the engine keeps scanning and trading. Exit protection meanwhile is
 * absolute: server-side OCO orders live on Binance and execute 24/7.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

export const BG_TICK_TASK = 'aitb-background-tick';

// Defined at module scope so it exists before the task is registered.
try {
  TaskManager.defineTask(BG_TICK_TASK, async () => {
    try {
      const mod = require('../engine/runtime');
      const runtime = mod.runtime;
      if (!runtime.isReady) return BackgroundFetch.BackgroundFetchResult.NoData;
      await runtime.runTick();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch {
  /* already defined — hot reload safety */
}

export async function registerBackgroundTick(): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS silently suspends background fetch; web has none
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BG_TICK_TASK);
    if (registered) return;
    await BackgroundFetch.registerTaskAsync(BG_TICK_TASK, {
      minimumInterval: 15 * 60, // Android minimum is 15 minutes
      stopOnTerminate: false, // keep trading after the app is swiped away
      startOnBoot: true, // survive phone reboot
    });
  } catch {
    /* some devices/ROMs reject background tasks — the foreground loop still works */
  }
}
