import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function PremiumLockBadge({ compact = false, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);

  return (
    <View style={[styles.badge, style]}>
      <Ionicons name="lock-closed" size={compact ? 10 : 12} color={colors.botBucks} />
      <Text style={styles.label}>Premium</Text>
    </View>
  );
}

const makeStyles = (colors, compact) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 4 : 5,
    backgroundColor: 'rgba(245,183,43,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,183,43,0.45)',
    paddingHorizontal: compact ? 8 : 10,
    paddingVertical: compact ? 3 : 4,
    borderRadius: 999,
  },
  label: {
    fontSize: compact ? 10 : 11,
    fontWeight: '800',
    color: colors.botBucks,
    letterSpacing: 0.3,
  },
});
