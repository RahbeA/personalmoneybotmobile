import React, { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { resolveCharacterPosterUri } from '../utils/modelCache';

/**
 * Static character thumbnail for the Moneyverse grid.
 * Uses the server cover PNG only — never downloads or renders a GLB.
 */
export default function CharacterPoster({
  previewUrl,
  style,
  resizeMode = 'contain',
}) {
  const { colors } = useTheme();
  const [uri, setUri] = useState(null);
  const [loading, setLoading] = useState(!!previewUrl);

  useEffect(() => {
    let cancelled = false;

    if (!previewUrl) {
      setUri(null);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      try {
        const existing = await resolveCharacterPosterUri({ previewUrl });
        if (!cancelled) setUri(existing);
      } catch {
        if (!cancelled) setUri(previewUrl);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [previewUrl]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.fill, style]}
        resizeMode={resizeMode}
      />
    );
  }

  return (
    <View style={[styles.fill, styles.fallback, style]}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
