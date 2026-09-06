import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  APP_BAR_H_PAD,
  APP_BAR_PADDING_TOP,
  APP_BAR_PADDING_BOTTOM,
  APP_BAR_ROW_HEIGHT,
} from './AppBar';

/**
 * Non-home app bar chrome — same outer padding + fixed row height as Home AppBar.
 * Left: back + screen content. Right: optional actions. No logo/stats.
 */
export default function ScreenAppBar({
  onBack,
  showBack = true,
  children,
  rightActions,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.appBar, style]}>
      <View style={styles.headerRow}>
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.body}>
            {children}
          </View>
        </View>

        {rightActions ? (
          <View style={styles.rightActions}>{rightActions}</View>
        ) : null}
      </View>
    </View>
  );
}

export function useScreenBack(navigation, fallbackTab = 'HomeTab') {
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.getParent()?.navigate(fallbackTab);
  }, [navigation, fallbackTab]);
}

/** Match Home AppBar: big title on top, small supporting line under it. */
export const screenAppBarTitleStyles = (colors) => ({
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.4,
  },
  eyebrow: {
    fontSize: 13,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

const makeStyles = (colors) => StyleSheet.create({
  appBar: {
    paddingHorizontal: APP_BAR_H_PAD,
    paddingTop: APP_BAR_PADDING_TOP,
    paddingBottom: APP_BAR_PADDING_BOTTOM,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    height: APP_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: APP_BAR_ROW_HEIGHT,
  },
  backBtn: {
    width: 36,
    height: APP_BAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    height: APP_BAR_ROW_HEIGHT,
    justifyContent: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
    marginLeft: 8,
    height: APP_BAR_ROW_HEIGHT,
  },
});
