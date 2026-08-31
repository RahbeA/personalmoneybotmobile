import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUserProgress } from '../context/UserProgressContext';
import BrandLogo from './brand/BrandLogo';
import PinnedStatsBar from './PinnedStatsBar';

/** Shared across every screen — keep logo placement identical app-wide. */
export const APP_BAR_LOGO_SIZE = 44;
export const APP_BAR_ROW_HEIGHT = 44;
export const APP_BAR_H_PAD = 16;
export const APP_BAR_PADDING_TOP = 4;
export const APP_BAR_PADDING_BOTTOM = 8;

export default function AppBar({
  variant = 'screen',
  title,
  subtitle,
  showBack,
  onBack,
  onLogoPress,
  onStatsPress,
  onStatPress,
  rightActions,
  showStats = true,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    xp, streakDays, botBucks, lessonsCompleted,
  } = useUserProgress();

  const isHome = variant === 'home';
  const showBackButton = showBack ?? !isHome;

  return (
    <View style={[styles.appBar, style]}>
      <View style={styles.headerRow}>
        <View style={[styles.sideCol, styles.sideColLeft]}>
          {isHome ? (
            <View style={styles.homeText}>
              {!!subtitle && (
                <Text style={styles.greeting} numberOfLines={1}>{subtitle}</Text>
              )}
              {!!title && (
                <Text style={styles.username} numberOfLines={1}>{title}</Text>
              )}
            </View>
          ) : (
            <View style={styles.screenLeft}>
              {showBackButton && (
                <TouchableOpacity
                  onPress={onBack}
                  style={styles.backBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={24} color={colors.white} />
                </TouchableOpacity>
              )}
              {!!title && (
                <Text style={styles.screenTitle} numberOfLines={1}>{title}</Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.sideCol, styles.sideColRight]} pointerEvents="box-none">
          {!!rightActions && (
            <View style={styles.rightActions}>{rightActions}</View>
          )}
          {showStats && (
            <PinnedStatsBar
              variant="corner"
              streakDays={streakDays}
              botBucks={botBucks}
              lessonsCompleted={lessonsCompleted}
              xp={xp}
              onPress={onStatPress ? undefined : onStatsPress}
              onStatPress={onStatPress}
            />
          )}
        </View>

        <View style={styles.logoSlot} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={onLogoPress ? 0.85 : 1}
            onPress={onLogoPress}
            disabled={!onLogoPress}
            style={styles.logoBtn}
          >
            <BrandLogo size={APP_BAR_LOGO_SIZE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  appBar: {
    paddingHorizontal: APP_BAR_H_PAD,
    paddingTop: APP_BAR_PADDING_TOP,
    paddingBottom: APP_BAR_PADDING_BOTTOM,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerRow: {
    height: APP_BAR_ROW_HEIGHT,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideCol: {
    flex: 1,
    minWidth: 0,
    height: APP_BAR_ROW_HEIGHT,
    justifyContent: 'center',
    zIndex: 1,
  },
  sideColLeft: {
    paddingRight: APP_BAR_LOGO_SIZE / 2 + 8,
  },
  sideColRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingLeft: APP_BAR_LOGO_SIZE / 2 + 8,
    gap: 6,
  },
  logoSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: APP_BAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  logoBtn: {
    width: APP_BAR_LOGO_SIZE,
    height: APP_BAR_LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeText: {
    justifyContent: 'center',
    height: APP_BAR_ROW_HEIGHT,
  },
  greeting: {
    fontSize: 13,
    lineHeight: 16,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  username: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.4,
  },
  screenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    height: APP_BAR_ROW_HEIGHT,
    gap: 2,
    maxWidth: '100%',
  },
  backBtn: {
    width: 36,
    height: APP_BAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    flexShrink: 0,
  },
  screenTitle: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
