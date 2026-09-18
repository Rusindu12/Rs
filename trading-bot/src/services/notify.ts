/**
 * Local trade notifications — the phone buzzes the moment the bot buys or
 * sells (works from background ticks too). Purely local: no push server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@aitb/tradeAlerts';

type NotifModule = {
  setNotificationHandler: (h: unknown) => void;
  getPermissionsAsync: () => Promise<{ granted: boolean; status: string; canAskAgain: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  scheduleNotificationAsync: (n: { content: { title: string; body: string; sound?: boolean }; trigger: null }) => Promise<string>;
};

let mod: NotifModule | null = null;
async function native(): Promise<NotifModule | null> {
  if (mod) return mod;
  try {
    // optional require keeps web/tests safe (no dynamic-import syntax)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const req = typeof globalThis.require === 'function' ? globalThis.require : undefined;
    mod = req ? (req('expo-notifications') as NotifModule) : null;
    return mod;
  } catch {
    return null;
  }
}

// Show alerts even while the app is foregrounded.
void (async () => {
  const m = await native();
  m?.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
})();

export async function tradeAlertsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) !== '0';
}

export async function setTradeAlerts(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
  if (on) await requestPerm();
}

async function requestPerm(): Promise<boolean> {
  const m = await native();
  if (!m) return false;
  try {
    const cur = await m.getPermissionsAsync();
    if (cur.granted || cur.status === 'granted') return true;
    if (!cur.canAskAgain) return false;
    return (await m.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function notifyTrade(title: string, body: string): Promise<void> {
  try {
    if (!(await tradeAlertsEnabled())) return;
    const m = await native();
    if (!m) return;
    await m.scheduleNotificationAsync({ content: { title, body, sound: false }, trigger: null });
  } catch {
    /* notifications are best-effort */
  }
}
