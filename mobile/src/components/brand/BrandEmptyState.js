import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import BrandAvatar from './BrandAvatar';

export default function BrandEmptyState({
  title,
  body,
  character,
  avatarSize = 72,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, style]}>
      <BrandAvatar character={character} size={avatarSize} />
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
