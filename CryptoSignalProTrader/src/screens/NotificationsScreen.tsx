import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Colors, getSignalColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { getNotifications, markNotificationRead } from '../services/databaseService';
import { Card } from '../components/common/Card';
import { formatTimeAgo } from '../utils/priceFormatter';

interface NotificationsProps { navigation: any; }

export const NotificationsScreen: React.FC<NotificationsProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const data = await getNotifications(100);
    setNotifications(data);
  };

  const handleRead = async (id: number) => {
    await markNotificationRead(id);
    loadNotifications();
  };

  const getEmoji = (type: string) => {
    switch (type) {
      case 'signal': return '📊';
      case 'trade': return '💰';
      case 'price_alert': return '🔔';
      case 'emergency': return '🚨';
      case 'system': return '⚙️';
      default: return '📱';
    }
  };

  const filtered = filter === 'ALL' ? notifications : notifications.filter(n => n.type === filter.toLowerCase());

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      <View style={styles.filters}>
        {['ALL', 'SIGNAL', 'TRADE', 'ALERT', 'SYSTEM'].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleRead(item.id)} style={[styles.notifCard, !item.is_read && styles.unread]}>
            <Text style={styles.emoji}>{getEmoji(item.type)}</Text>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifMessage}>{item.message}</Text>
              <Text style={styles.notifTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.lg },
  filters: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.lg },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.card },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { ...Typography.caption, color: Colors.textSecondary },
  filterTextActive: { color: Colors.textInverse, fontWeight: '700' },
  list: { paddingBottom: 100 },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  unread: { borderColor: Colors.primary, backgroundColor: 'rgba(240,185,11,0.05)' },
  emoji: { fontSize: 24, marginRight: Spacing.md },
  notifContent: { flex: 1 },
  notifTitle: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  notifMessage: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  notifTime: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.lg },
  emptyText: { ...Typography.body2, color: Colors.textTertiary },
});
