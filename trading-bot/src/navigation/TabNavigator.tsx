import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SignalsScreen } from '../screens/SignalsScreen';
import { TradesScreen } from '../screens/TradesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ActivityScreen } from '../screens/ActivityScreen';

type TabKey = 'dashboard' | 'signals' | 'activity' | 'trades' | 'profile' | 'settings';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'signals', label: 'Signals', icon: '⚡' },
  { key: 'activity', label: 'Activity', icon: '💹' },
  { key: 'trades', label: 'Trades', icon: '📋' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TabNavigator() {
  const [active, setActive] = React.useState<TabKey>('dashboard');
  const Screen = {
    dashboard: DashboardScreen,
    signals: SignalsScreen,
    activity: ActivityScreen,
    trades: TradesScreen,
    profile: ProfileScreen,
    settings: SettingsScreen,
  }[active];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Screen />
        </View>
        <View style={styles.tabbar}>
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <Pressable
                key={t.key}
                onPress={() => setActive(t.key)}
                style={[styles.tab, isActive && styles.tabActive]}
                android_ripple={{ color: colors.border }}
              >
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
                <View style={[styles.tabDot, isActive && styles.tabDotActive]} />
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'android' ? 2 : 0,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 12, marginHorizontal: 4 },
  tabActive: { backgroundColor: '#F0B90B14' },
  tabIcon: { fontSize: 18, opacity: 0.55 },
  tabIconActive: { opacity: 1 },
  tabLabel: { color: colors.textFaint, fontSize: 10, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: colors.gold },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  tabDotActive: { backgroundColor: colors.gold },
});
