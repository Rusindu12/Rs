import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

import { DashboardScreen } from '../screens/DashboardScreen';
import { SignalsScreen } from '../screens/SignalsScreen';
import { TradingScreen } from '../screens/TradingScreen';
import { ChartScreen } from '../screens/ChartScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { TradeHistoryScreen } from '../screens/TradeHistoryScreen';
import { BotControlScreen } from '../screens/BotControlScreen';
import { BotSettingsScreen } from '../screens/BotSettingsScreen';
import { BacktestScreen } from '../screens/BacktestScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabIcon = ({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) => (
  <View style={styles.tabIcon}>
    <Text style={{ fontSize: 20 }}>{emoji}</Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  </View>
);

const MainTabs = () => (
  <Tab.Navigator screenOptions={{
    headerShown: false,
    tabBarStyle: styles.tabBar,
    tabBarShowLabel: false,
    tabBarHideOnKeyboard: true,
  }}>
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{
      tabBarIcon: ({ focused }) => <TabIcon label="Home" emoji="🏠" focused={focused} />,
    }} />
    <Tab.Screen name="Signals" component={SignalsScreen} options={{
      tabBarIcon: ({ focused }) => <TabIcon label="Signals" emoji="📊" focused={focused} />,
    }} />
    <Tab.Screen name="Trading" component={TradingScreen} options={{
      tabBarIcon: ({ focused }) => <TabIcon label="Trade" emoji="💱" focused={focused} />,
    }} />
    <Tab.Screen name="Bot" component={BotControlScreen} options={{
      tabBarIcon: ({ focused }) => <TabIcon label="Bot" emoji="🤖" focused={focused} />,
    }} />
    <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{
      tabBarIcon: ({ focused }) => <TabIcon label="Portfolio" emoji="💼" focused={focused} />,
    }} />
  </Tab.Navigator>
);

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Charts" component={ChartScreen} />
        <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} />
        <Stack.Screen name="BotSettings" component={BotSettingsScreen} />
        <Stack.Screen name="Backtest" component={BacktestScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 65,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabIcon: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2, fontSize: 10 },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },
});
