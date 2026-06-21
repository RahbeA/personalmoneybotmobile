import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveMediaUrl } from '../utils/mediaUrl';

export default function BadgeIcon({ badge, size = 44, style }) {
  const radius = size / 2;
  const color = badge?.accent_color || '#3DDC5F';
  const iconUri = resolveMediaUrl(badge?.icon_url);

  if (iconUri) {
    return (
      <Image
        source={{ uri: iconUri }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color + '22',
          borderColor: color + '55',
        },
        style,
      ]}
    >
      <Ionicons name={badge?.ion_icon || 'ribbon'} size={size * 0.45} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
