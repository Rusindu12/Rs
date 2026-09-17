import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

/* --------------------------------- Card --------------------------------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitle}>{children}</Text>
      {right}
    </View>
  );
}

/* -------------------------------- Badge --------------------------------- */

export function Badge({
  text,
  tone = 'neutral',
  small,
}: {
  text: string;
  tone?: 'buy' | 'sell' | 'neutral' | 'gold' | 'info';
  small?: boolean;
}) {
  const bg =
    tone === 'buy' ? colors.greenDim : tone === 'sell' ? colors.redDim : tone === 'gold' ? '#F0B90B22' : tone === 'info' ? '#1E80FF22' : colors.border;
  const fg = tone === 'buy' ? colors.green : tone === 'sell' ? colors.red : tone === 'gold' ? colors.gold : tone === 'info' ? colors.blue : colors.textDim;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color: fg }, small && styles.badgeTextSmall]}>{text}</Text>
    </View>
  );
}

export function actionTone(action: string): 'buy' | 'sell' | 'neutral' | 'gold' {
  if (action === 'STRONG_BUY') return 'buy';
  if (action === 'BUY') return 'buy';
  if (action === 'STRONG_SELL' || action === 'SELL') return 'sell';
  return 'gold';
}

/* -------------------------------- Button -------------------------------- */

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    tone === 'primary' ? colors.gold : tone === 'danger' ? colors.red : tone === 'success' ? colors.green : 'transparent';
  const fg = tone === 'ghost' ? colors.text : tone === 'primary' ? '#12161C' : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        tone === 'ghost' && styles.buttonGhost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ------------------------------ StatusDot -------------------------------- */

export function StatusDot({ ok, size = 8 }: { ok: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ok ? colors.green : colors.red,
        shadowColor: ok ? colors.green : colors.red,
        shadowRadius: 4,
        shadowOpacity: 0.9,
      }}
    />
  );
}

/* -------------------------------- Fields --------------------------------- */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  hint,
  autoCapitalize = 'none',
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  hint?: string;
  autoCapitalize?: 'none' | 'sentences';
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && { opacity: 0.6 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------- Segmented ------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------- Row ----------------------------------- */

export function Row({
  left,
  right,
  leftStyle,
  rightStyle,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  leftStyle?: StyleProp<TextStyle>;
  rightStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLeft, leftStyle]}>{left}</Text>
      <Text style={[styles.rowRight, rightStyle]}>{right}</Text>
    </View>
  );
}

/* -------------------------------- Toggle --------------------------------- */

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.toggle, value && styles.toggleOn]}
      hitSlop={8}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );
}

/* ------------------------------ ConfirmModal ----------------------------- */

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          {message ? <Text style={styles.modalMessage}>{message}</Text> : null}
          {children}
          <View style={styles.modalActions}>
            <Button label="Cancel" tone="ghost" onPress={onCancel} style={styles.modalBtn} />
            <Button
              label={confirmLabel}
              tone={danger ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------- Screen --------------------------------- */

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={styles.screen}>{children}</View>;
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextSmall: { fontSize: 10 },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: { borderWidth: 1, borderColor: colors.border },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  fieldHint: { color: colors.textFaint, fontSize: 11, marginTop: 5 },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.gold },
  segmentText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: '#12161C' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  rowLeft: { color: colors.textDim, fontSize: 13 },
  rowRight: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
  },
  toggleOn: { backgroundColor: colors.green },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000AA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  modalMessage: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtn: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptySubtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4, textAlign: 'center' },
});
