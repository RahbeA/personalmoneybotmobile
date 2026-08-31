import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const STAT_ITEMS = [
  { key: 'streak', icon: 'flame', label: 'Streak', colorKey: 'streak', field: 'streakDays' },
  { key: 'bucks', icon: 'logo-bitcoin', label: 'Bucks', colorKey: 'botBucks', field: 'botBucks' },
  { key: 'lessons', icon: 'school', label: 'Lessons', colorKey: 'primary', field: 'lessonsCompleted' },
  { key: 'xp', icon: 'flash', label: 'XP', colorKey: 'primaryLight', field: 'xp' },
];

export default function PinnedStatsBar({
  streakDays,
  botBucks,
  lessonsCompleted,
  xp,
  onPress,
  onStatPress,
  variant = 'strip',
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCorner = variant === 'corner';

  const values = { streakDays, botBucks, lessonsCompleted, xp };

  function renderStat(item, compact) {
    const inner = (
      <>
        <Ionicons name={item.icon} size={compact ? 10 : 13} color={colors[item.colorKey]} />
        <Text style={compact ? styles.cornerVal : styles.val}>{values[item.field] ?? 0}</Text>
        {!compact ? <Text style={styles.lbl}>{item.label}</Text> : null}
      </>
    );
    if (onStatPress) {
      return (
        <TouchableOpacity
          key={item.key}
          style={compact ? styles.cornerCell : styles.cell}
          activeOpacity={0.75}
          onPress={() => onStatPress(item.key)}
          hitSlop={compact ? 6 : 4}
        >
          {inner}
        </TouchableOpacity>
      );
    }
    return (
      <View key={item.key} style={compact ? styles.cornerCell : styles.cell}>
        {inner}
      </View>
    );
  }

  const content = isCorner ? (
    <View style={styles.cornerRow}>
      {STAT_ITEMS.map((item) => renderStat(item, true))}
    </View>
  ) : (
    <View style={styles.strip}>
      {STAT_ITEMS.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 && <View style={styles.divider} />}
          {renderStat(item, false)}
        </React.Fragment>
      ))}
    </View>
  );

  const wrapStyle = [isCorner ? styles.cornerWrap : styles.wrap, style];

  if (onPress && !onStatPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={wrapStyle}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={wrapStyle}>{content}</View>;
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  val: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 16,
  },
  lbl: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  cornerWrap: {
    flexShrink: 0,
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cornerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  cornerVal: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 12,
  },
});
