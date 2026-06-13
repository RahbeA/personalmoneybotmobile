import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import CharacterViewer from '../CharacterViewer';
import BrandLogo from './BrandLogo';

export default function BrandAvatar({
  character,
  size = 40,
  autoRotate = false,
  style,
  logoSize,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, size), [colors, size]);
  const resolvedLogoSize = logoSize ?? Math.round(size * 0.72);

  if (character?.model_url) {
    return (
      <View style={[styles.wrap, styles.characterWrap, style]}>
        <CharacterViewer
          modelUrl={character.model_url}
          previewUrl={character.preview_url}
          autoRotate={autoRotate}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.primaryTintStrong, colors.primaryTint]}
      style={[styles.wrap, styles.logoWrap, style]}
    >
      <BrandLogo size={resolvedLogoSize} />
    </LinearGradient>
  );
}

const makeStyles = (colors, size) => StyleSheet.create({
  wrap: {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterWrap: {
    backgroundColor: colors.surfaceElevated,
  },
});
