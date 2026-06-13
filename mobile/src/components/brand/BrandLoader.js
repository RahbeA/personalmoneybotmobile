import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from './BrandLogo';

export default function BrandLoader({ message, size = 'xl', fullScreen = true }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fullScreen), [colors, fullScreen]);
  const pulse = useRef(new Animated.Value(0.92)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.92, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.75, duration: 900, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, glow]);

  return (
    <View style={styles.wrap}>
      <View style={styles.logoWrap}>
        <Animated.View
          style={[
            styles.glowRing,
            { opacity: glow, transform: [{ scale: pulse }] },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <BrandLogo size={size} />
        </Animated.View>
      </View>
      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const makeStyles = (colors, fullScreen) => StyleSheet.create({
  wrap: {
    flex: fullScreen ? 1 : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fullScreen ? colors.background : 'transparent',
    padding: fullScreen ? 24 : 0,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryTintStrong,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  message: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
