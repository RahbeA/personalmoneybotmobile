import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BRAND_NAME, BRAND_TAGLINE } from '../../constants/brandCopy';
import BrandLogo from './BrandLogo';

export default function BrandLockup({
  logoSize = 'sm',
  showTagline = false,
  tagline = BRAND_TAGLINE,
  align = 'center',
  stacked = false,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, align, stacked), [colors, align, stacked]);

  return (
    <View style={[styles.wrap, style]}>
      <BrandLogo size={logoSize} />
      <View style={styles.textWrap}>
        <Text style={styles.name}>{BRAND_NAME}</Text>
        {showTagline && !!tagline && (
          <Text style={styles.tagline}>{tagline}</Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors, align, stacked) => StyleSheet.create({
  wrap: {
    flexDirection: stacked ? 'column' : 'row',
    alignItems: 'center',
    gap: stacked ? 6 : 10,
    justifyContent: align === 'center' ? 'center' : 'flex-start',
  },
  textWrap: {
    alignItems: align === 'center' ? 'center' : 'flex-start',
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  tagline: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
