import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, LogBox, View, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { initDatabase, getEngineState, saveEngineState } from './src/services/databaseService';
import { getApiKey, getApiSecret } from './src/services/encryptionService';
import { registerForPushNotifications } from './src/services/notificationService';
import { binanceRest } from './src/api/binanceRest';
import { tradingService } from './src/background/tradingService';
import { recoverFromCrash } from './src/background/crashRecovery';
import { registerBackgroundFetch } from './src/background/backgroundTasks';
import { logger } from './src/services/loggingService';
import { Colors } from './src/theme/colors';

import { SplashScreen } from './src/screens/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

LogBox.ignoreLogs(['Non-serializable values', 'Remote debugger']);

type AppState = 'splash' | 'onboarding' | 'auth' | 'main';

const AppContent: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('splash');
  const [isReady, setIsReady] = useState(false);

  const initialize = useCallback(async () => {
    try {
      logger.info('App initializing...');

      // 1. Initialize database FIRST
      await initDatabase();
      logger.info('Database initialized');

      // 2. Check if first launch
      const hasLaunched = await getEngineState('has_launched');
      if (!hasLaunched) {
        setAppState('onboarding');
        return;
      }

      // 3. Check for API credentials
      const apiKey = await getApiKey();
      const apiSecret = await getApiSecret();

      if (!apiKey || !apiSecret) {
        setAppState('auth');
        return;
      }

      // 4. Configure Binance client
      const isTestnet = await getEngineState('is_testnet');
      binanceRest.configure(apiKey, apiSecret, isTestnet !== false);

      // 5. Test connection
      const connectionTest = await binanceRest.testConnection();
      if (!connectionTest.success) {
        logger.warn('Binance connection test failed, continuing anyway');
      }

      // 6. Register for push notifications
      await registerForPushNotifications();

      // 7. Try crash recovery
      const settings = await getEngineState('app_settings');
      if (settings) {
        try {
          await recoverFromCrash(settings);
        } catch (error) {
          logger.warn('Crash recovery skipped');
        }
      }

      // 8. Register background fetch
      await registerBackgroundFetch();

      // 9. Save state for crash recovery
      await saveEngineState('last_app_start', new Date().toISOString());

      setIsReady(true);
      setAppState('main');
      logger.info('App initialized successfully');
    } catch (error: any) {
      logger.fatal(`App initialization failed: ${error.message}`);
      setIsReady(true);
      setAppState('main');
    }
  }, []);

  const handleSplashFinish = useCallback(() => {
    initialize();
  }, [initialize]);

  const handleOnboardingComplete = useCallback(async () => {
    await saveEngineState('has_launched', true);
    setAppState('auth');
  }, []);

  const handleAuthComplete = useCallback(async () => {
    setAppState('main');
  }, []);

  if (appState === 'splash') {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (appState === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (appState === 'auth') {
    return <AuthScreen onComplete={handleAuthComplete} />;
  }

  return <AppNavigator />;
};

export default function App() {
  return (
    <Provider store={store}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} translucent />
        <AppContent />
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
