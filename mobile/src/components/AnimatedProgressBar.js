import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Shared progress fill. Animates on change via scaleX + native driver once
 * the track has a measured width (width itself cannot use the native driver).
 */
export default function AnimatedProgressBar({
  progress = 0,
  height = 8,
  trackColor,
  fillColor,
  style,
  borderRadius,
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const anim = useRef(new Animated.Value(clamped)).current;
  const laidOutRef = useRef(false);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackWidth <= 0) return;
    if (!laidOutRef.current) {
      laidOutRef.current = true;
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [anim, clamped, trackWidth]);

  const radius = borderRadius ?? Math.ceil(height / 2);
  const track = trackColor ?? colors.surface;
  const fill = fillColor ?? colors.primary;

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: track,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        style,
      ]}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== trackWidth) setTrackWidth(next);
      }}
    >
      {trackWidth > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: trackWidth,
            backgroundColor: fill,
            borderRadius: radius,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-trackWidth / 2, 0],
                }),
              },
              { scaleX: anim },
            ],
          }}
        />
      ) : null}
    </View>
  );
}
