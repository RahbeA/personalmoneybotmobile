import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TypewriterText from './TypewriterText';

const GUIDE = require('../../assets/moneybot-guide.png');

/**
 * MoneyBot narrator row: 2D guide avatar + typed message bubble.
 */
export default function MoneyBotGuide({
  message,
  onDone,
  avatarSize = 64,
  speed = 26,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, avatarSize), [colors, avatarSize]);

  return (
    <View style={[styles.row, style]}>
      <View style={styles.avatarRing}>
        <Image source={GUIDE} style={styles.avatar} resizeMode="contain" />
      </View>
      <View style={styles.bubble}>
        <TypewriterText
          key={message}
          text={message}
          style={styles.message}
          speed={speed}
          onDone={onDone}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors, avatarSize) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarRing: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primaryTintStrong,
    backgroundColor: colors.surfaceElevated,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: avatarSize * 0.7,
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 22,
  },
});
