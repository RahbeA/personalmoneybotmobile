import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { CHAT_PERSONALITIES } from './personalities';

export default function PersonalityChips({
  selected = 'chill',
  savingKey = null,
  onSelect,
  padded = true,
  variant = 'chips',
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDock = variant === 'dock';

  const cells = CHAT_PERSONALITIES.map((item) => {
    const active = selected === item.key;
    const saving = savingKey === item.key;
    const iconColor = active ? '#0A0A0A' : (item.accent || colors.primary);
    return (
      <TouchableOpacity
        key={item.key}
        style={[
          isDock ? styles.dockCell : styles.chip,
          active && (isDock ? styles.dockCellActive : styles.chipActive),
          active && isDock && { backgroundColor: item.accent || colors.primary, borderColor: item.accent || colors.primary },
        ]}
        activeOpacity={0.85}
        onPress={() => onSelect?.(item)}
        disabled={!!savingKey}
        accessibilityRole="button"
        accessibilityLabel={`${item.label} voice`}
        accessibilityState={{ selected: active, disabled: !!savingKey }}
      >
        {saving ? (
          <ActivityIndicator size="small" color={active ? '#0A0A0A' : colors.primary} />
        ) : (
          <Ionicons
            name={item.icon}
            size={isDock ? 16 : 14}
            color={iconColor}
          />
        )}
        <Text
          style={[
            isDock ? styles.dockLabel : styles.label,
            active && (isDock ? styles.dockLabelActive : styles.labelActive),
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (isDock) {
    return (
      <View style={[styles.dock, padded && styles.dockPadded]}>
        {cells}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={[styles.row, padded && styles.rowPadded]}
    >
      {cells}
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  row: {
    gap: 8,
    paddingBottom: 10,
  },
  rowPadded: {
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  labelActive: {
    color: colors.background,
  },

  dock: {
    flexDirection: 'row',
    gap: 6,
  },
  dockPadded: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dockCell: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dockCellActive: {
    backgroundColor: colors.primary,
  },
  dockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  dockLabelActive: {
    color: '#0A0A0A',
  },
});
