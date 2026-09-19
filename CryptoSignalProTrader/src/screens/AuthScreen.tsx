import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Toggle';
import { Card } from '../components/common/Card';
import { storeApiKey, storeApiSecret } from '../services/encryptionService';
import { binanceRest } from '../api/binanceRest';
import { validateApiKey, validateApiSecret } from '../utils/validators';

interface AuthScreenProps {
  onComplete: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onComplete }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTestnet, setIsTestnet] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleTestConnection = async () => {
    setError('');
    const keyValidation = validateApiKey(apiKey);
    if (!keyValidation.valid) { setError(keyValidation.error); return; }
    const secretValidation = validateApiSecret(apiSecret);
    if (!secretValidation.valid) { setError(secretValidation.error); return; }

    setIsConnecting(true);
    try {
      binanceRest.configure(apiKey, apiSecret, isTestnet);
      const result = await binanceRest.testConnection();
      if (result.success) {
        Alert.alert('✅ Connected!', `Latency: ${result.latency}ms\nServer time: ${new Date(result.serverTime).toLocaleString()}`);
        await storeApiKey(apiKey);
        await storeApiSecret(apiSecret);
        onComplete();
      } else {
        setError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsConnecting(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>Connect Binance</Text>
        <Text style={styles.subtitle}>Enter your API credentials to start trading</Text>

        <Card style={styles.card}>
          <Input label="API Key" value={apiKey} onChangeText={setApiKey} placeholder="Enter your Binance API key" secureTextEntry autoCapitalize="none" />
          <Input label="API Secret" value={apiSecret} onChangeText={setApiSecret} placeholder="Enter your Binance API secret" secureTextEntry autoCapitalize="none" />

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Testnet Mode</Text>
              <Text style={styles.toggleDesc}>Use Binance testnet for safe testing</Text>
            </View>
            <Toggle value={isTestnet} onValueChange={setIsTestnet} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Test Connection" onPress={handleTestConnection} loading={isConnecting} variant="primary" fullWidth />
        </Card>

        <View style={styles.safetyNote}>
          <Text style={styles.safetyTitle}>🔒 Security Notes</Text>
          <Text style={styles.safetyText}>• API keys are stored with AES-256 encryption</Text>
          <Text style={styles.safetyText}>• Disable WITHDRAW permissions on your API key</Text>
          <Text style={styles.safetyText}>• Use testnet mode first to practice safely</Text>
          <Text style={styles.safetyText}>• Paper trading is ON by default</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingTop: 60 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.lg },
  title: { ...Typography.h1, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xxl },
  card: { marginBottom: Spacing.xl },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg },
  toggleLabel: { ...Typography.body1, color: Colors.textPrimary },
  toggleDesc: { ...Typography.caption, color: Colors.textTertiary },
  error: { ...Typography.body2, color: Colors.danger, marginBottom: Spacing.md, textAlign: 'center' },
  safetyNote: { backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  safetyTitle: { ...Typography.h4, color: Colors.info, marginBottom: Spacing.sm },
  safetyText: { ...Typography.body2, color: Colors.textSecondary, marginBottom: 4 },
});
