import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Darken (negative) or lighten (positive) a hex color. */
export function shadeHex(hex, amount) {
  const raw = String(hex || '').replace('#', '');
  if (raw.length !== 6) return hex;
  const mix = (channel) => {
    const value = parseInt(raw.slice(channel, channel + 2), 16);
    const target = amount < 0 ? 0 : 255;
    const next = Math.round(value + (target - value) * Math.abs(amount));
    return Math.max(0, Math.min(255, next)).toString(16).padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

/**
 * Duolingo-style 3D puck: a raised face over a darker lip. Pressing slides
 * the face down onto the lip.
 */
export default function PuckButton({
  color = '#42CF5A',
  width,
  height,
  borderRadius,
  lip = 7,
  disabled = false,
  onPress,
  children,
  style,
  contentStyle,
  accessibilityLabel,
}) {
  const [pressed, setPressed] = useState(false);
  const isPressed = disabled ? false : pressed;
  const stretch = width == null;
  const radius = borderRadius ?? (width != null && height != null
    ? Math.min(width, height) / 2
    : 18);
  const face = color;
  const lipColor = shadeHex(color, -0.32);
  const highlight = shadeHex(color, 0.28);
  const mid = shadeHex(color, -0.06);

  const shell = (
    <View
      style={[
        stretch ? styles.stretchShell : { width },
        { height: (height || 0) + lip },
        !onPress && style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.lip,
          { height, borderRadius: radius, backgroundColor: lipColor },
        ]}
      />
      <View
        style={[
          styles.face,
          stretch ? styles.stretchFace : { width },
          {
            height,
            borderRadius: radius,
            transform: [{ translateY: isPressed ? lip : 0 }],
          },
        ]}
      >
        <LinearGradient
          colors={[highlight, face, mid]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.grad, { borderRadius: radius }, contentStyle]}
        >
          {children}
        </LinearGradient>
      </View>
    </View>
  );

  if (!onPress || disabled) {
    return shell;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={accessibilityLabel}
      style={[stretch && styles.stretchPress, style]}
    >
      {shell}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stretchPress: { alignSelf: 'stretch' },
  stretchShell: { alignSelf: 'stretch' },
  stretchFace: { alignSelf: 'stretch' },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  face: {
    overflow: 'hidden',
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
