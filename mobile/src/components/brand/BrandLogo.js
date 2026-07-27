import React, { useMemo } from 'react';
import { Image, Dimensions, StyleSheet } from 'react-native';

const LOGO = require('../../../assets/logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SIZES = {
  xs: 20,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
  // Cap so the logo stays inside Landing's content column on iPad.
  hero: Math.min(SCREEN_WIDTH * 0.62, 260),
};

export default function BrandLogo({ size = 'md', style }) {
  const dimension = useMemo(() => {
    if (typeof size === 'number') return size;
    return SIZES[size] ?? SIZES.md;
  }, [size]);

  return (
    <Image
      source={LOGO}
      style={[styles.logo, { width: dimension, height: dimension }, style]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});
