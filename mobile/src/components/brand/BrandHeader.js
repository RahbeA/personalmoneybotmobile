import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import BrandLockup from './BrandLockup';
import BrandAvatar from './BrandAvatar';

export default function BrandHeader({
  title,
  subtitle,
  character,
  variant = 'page',
  style,
  right,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.main}>
        {variant === 'lockup' && (
          <BrandLockup logoSize="xs" />
        )}

        {variant === 'avatar' && (
          <View style={styles.avatarRow}>
            <BrandAvatar character={character} size={40} autoRotate={!!character} />
            {(title || subtitle) && (
              <View style={styles.textWrap}>
                {!!title && <Text style={styles.title}>{title}</Text>}
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}
          </View>
        )}

        {variant === 'page' && (title || subtitle) && (
          <View style={styles.textWrap}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  right: {
    paddingTop: 4,
  },
});
