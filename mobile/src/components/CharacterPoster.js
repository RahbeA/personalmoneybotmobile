import React, { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { resolveCharacterPosterUri, peekGeneratedPosterUri } from '../utils/modelCache';
import { ensureModelPoster } from './PosterCaptureHost';

/**
 * Static character thumbnail for the Moneyverse grid.
 *
 * When `modelUrl` is provided it shows a still frame rendered from the actual
 * GLB (captured once, off-screen, by PosterCaptureHost) so every character has
 * a real 3D preview even without an uploaded cover image. The uploaded PNG
 * (`previewUrl`), if any, is used as an instant placeholder while the still is
 * generated. Falls back gracefully when neither is available.
 */
export default function CharacterPoster({
  previewUrl,
  modelUrl,
  style,
  resizeMode = 'contain',
}) {
  const { colors } = useTheme();
  const [uri, setUri] = useState(null);
  const [loading, setLoading] = useState(!!previewUrl || !!modelUrl);

  useEffect(() => {
    let cancelled = false;

    if (!previewUrl && !modelUrl) {
      setUri(null);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);

      // 1. Instant: an already-captured 3D still on disk.
      if (modelUrl) {
        try {
          const cached = await peekGeneratedPosterUri(modelUrl);
          if (cached && !cancelled) {
            setUri(cached);
            setLoading(false);
          }
        } catch { /* fall through */ }
      }

      // 2. Placeholder: uploaded cover image while we render the 3D still.
      if (previewUrl) {
        try {
          const existing = await resolveCharacterPosterUri({ previewUrl });
          if (existing && !cancelled) {
            setUri((prev) => prev || existing);
            setLoading(false);
          }
        } catch {
          if (!cancelled) setUri((prev) => prev || previewUrl);
        }
      }

      // 3. Render a still from the GLB (queued, one at a time) and swap it in.
      if (modelUrl) {
        try {
          const generated = await ensureModelPoster(modelUrl);
          if (generated && !cancelled) setUri(generated);
        } catch { /* keep whatever fallback we have */ }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [previewUrl, modelUrl]);

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
