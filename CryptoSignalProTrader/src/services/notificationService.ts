import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { saveNotification } from './databaseService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trading', {
      name: 'Trading Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F0B90B',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('signals', {
      name: 'Signal Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100],
      lightColor: '#0ECB81',
    });

    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#F6465D',
      sound: 'default',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
};

export const sendLocalNotification = async (
  title: string,
  body: string,
  data?: any,
  channelId: string = 'trading'
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
  });
};

export const sendTradeNotification = async (
  symbol: string,
  side: string,
  price: number,
  pnl?: number
): Promise<void> => {
  const emoji = side === 'BUY' ? '🟢' : '🔴';
  const title = `${emoji} ${side} ${symbol}`;
  const body = pnl !== undefined
    ? `Price: $${price.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
    : `Executed at $${price.toFixed(2)}`;

  await sendLocalNotification(title, body, { symbol, side, price, pnl }, 'trading');
  await saveNotification('trade', title, body, { symbol, side, price, pnl });
};

export const sendSignalNotification = async (
  symbol: string,
  signalType: string,
  confidence: number,
  price: number
): Promise<void> => {
  const emoji = signalType.includes('BUY') ? '📈' : signalType.includes('SELL') ? '📉' : '➡️';
  const title = `${emoji} ${signalType} Signal - ${symbol}`;
  const body = `Confidence: ${confidence.toFixed(0)}% | Price: $${price.toFixed(2)}`;

  await sendLocalNotification(title, body, { symbol, signalType, confidence, price }, 'signals');
  await saveNotification('signal', title, body, { symbol, signalType, confidence, price });
};

export const sendPanicNotification = async (reason: string): Promise<void> => {
  const title = '🚨 PANIC - All Positions Closed';
  const body = `Reason: ${reason}`;
  await sendLocalNotification(title, body, { reason }, 'emergency');
  await saveNotification('emergency', title, body, { reason });
};

export const sendPriceAlert = async (symbol: string, price: number, condition: string): Promise<void> => {
  const title = `💰 Price Alert - ${symbol}`;
  const body = `${symbol} is now ${condition} $${price.toFixed(2)}`;
  await sendLocalNotification(title, body, { symbol, price, condition });
  await saveNotification('price_alert', title, body, { symbol, price, condition });
};

export const sendDailySummary = async (
  totalTrades: number,
  winRate: number,
  pnl: number,
  portfolioValue: number
): Promise<void> => {
  const emoji = pnl >= 0 ? '✅' : '❌';
  const title = `${emoji} Daily Trading Summary`;
  const body = `Trades: ${totalTrades} | Win Rate: ${winRate.toFixed(1)}% | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | Portfolio: $${portfolioValue.toFixed(2)}`;
  await sendLocalNotification(title, body, { totalTrades, winRate, pnl, portfolioValue });
};

export const addNotificationReceivedListener = (
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(handler);
};

export const addNotificationResponseListener = (
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(handler);
};
