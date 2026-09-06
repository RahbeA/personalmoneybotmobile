import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PuckButton from './PuckButton';

export default function MoneyTipModal({
  visible,
  tip,
  categoryLabel,
  onDismiss,
  colors,
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!tip?.body) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.badge}>
            <Ionicons name="bulb" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.kicker}>{(categoryLabel || 'Money tip').toUpperCase()}</Text>
          <Text style={styles.title}>Today&apos;s money tip</Text>
          <Text style={styles.body}>{tip.body}</Text>

          <PuckButton
            color={colors.primary}
            height={54}
            borderRadius={16}
            lip={5}
            onPress={onDismiss}
            contentStyle={styles.ctaInner}
          >
            <Text style={styles.ctaText}>Got it</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </PuckButton>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 18, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.primaryTint || 'rgba(61,220,95,0.35)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: 'center',
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
