import React, { useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, Pressable, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const COIN_COUNT = 14;
const GOLD = '#F5B72B';
const GOLD_LIGHT = '#FFD75E';
const ORANGE = '#FF6B35';

// A short, punchy "you got paid" moment. Pure Animated (no native deps) so it
// runs on the existing dev client without a rebuild. Auto-dismisses, but a tap
// anywhere lets an impatient user skip it.
export default function DailyClaimCelebration({ visible, amount = 0, onDone }) {
  const { width, height } = useWindowDimensions();

  // Precompute a random-ish spray for each burst coin so every claim looks a
  // little different but stays balanced around the center.
  const coins = useMemo(() => {
    return Array.from({ length: COIN_COUNT }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / COIN_COUNT + (Math.random() - 0.5) * 0.5;
      const distance = 120 + Math.random() * 140;
      return {
        key: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 60, // bias upward so they arc up first
        size: 16 + Math.random() * 16,
        delay: Math.random() * 120,
        spin: (Math.random() - 0.5) * 2,
      };
    });
  }, [visible]);

  const backdrop = useRef(new Animated.Value(0)).current;
  const coinPop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const amountAnim = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  useEffect(() => {
    if (!visible) return undefined;
    finished.current = false;
    backdrop.setValue(0);
    coinPop.setValue(0);
    burst.setValue(0);
    amountAnim.setValue(0);
    ring.setValue(0);

    const sequence = Animated.sequence([
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(coinPop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(amountAnim, { toValue: 1, friction: 6, tension: 90, delay: 120, useNativeDriver: true }),
      ]),
      Animated.delay(650),
    ]);

    sequence.start(({ finished: done }) => {
      if (done) close();
    });

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function close() {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(backdrop, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      onDone?.();
    });
  }

  if (!visible) return null;

  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.fill} onPress={close}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />

        {/* Radial glow behind the coin */}
        <Animated.View
          style={[
            styles.glow,
            {
              left: centerX - 160,
              top: centerY - 160,
              opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
              transform: [{ scale: coinPop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(245,183,43,0.55)', 'rgba(255,107,53,0.15)', 'rgba(255,107,53,0)']}
            style={styles.glowGrad}
          />
        </Animated.View>

        {/* Expanding ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              left: centerX - 70,
              top: centerY - 70,
              opacity: ring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 0.4, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) }],
            },
          ]}
        />

        {/* Burst coins */}
        {coins.map((c) => {
          const translateX = burst.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] });
          const translateY = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, c.dy, c.dy + 90] });
          const opacity = burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
          const scale = burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.2, 1, 0.7] });
          const rotate = burst.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${c.spin * 540}deg`],
          });
          return (
            <Animated.View
              key={c.key}
              style={{
                position: 'absolute',
                left: centerX - c.size / 2,
                top: centerY - c.size / 2,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              }}
            >
              <View style={[styles.miniCoin, { width: c.size, height: c.size, borderRadius: c.size / 2 }]}>
                <Ionicons name="logo-bitcoin" size={c.size * 0.62} color="#7A4E00" />
              </View>
            </Animated.View>
          );
        })}

        {/* Hero coin */}
        <Animated.View
          style={[
            styles.heroWrap,
            {
              left: centerX - 55,
              top: centerY - 55,
              opacity: coinPop,
              transform: [
                { scale: coinPop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                {
                  rotate: coinPop.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }),
                },
              ],
            },
          ]}
        >
          <LinearGradient colors={[GOLD_LIGHT, GOLD]} style={styles.heroCoin}>
            <Ionicons name="logo-bitcoin" size={54} color="#7A4E00" />
          </LinearGradient>
        </Animated.View>

        {/* Amount + label */}
        <Animated.View
          style={[
            styles.amountWrap,
            {
              top: centerY + 80,
              opacity: amountAnim,
              transform: [
                { scale: amountAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                { translateY: amountAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <Text style={styles.amountText}>+{amount}</Text>
          <Text style={styles.amountLabel}>Bot Bucks claimed!</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  glow: { position: 'absolute', width: 320, height: 320 },
  glowGrad: { flex: 1, borderRadius: 160 },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: ORANGE,
  },
  miniCoin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: GOLD_LIGHT,
  },
  heroWrap: { position: 'absolute', width: 110, height: 110 },
  heroCoin: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFE9A8',
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  amountWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  amountText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textShadowColor: 'rgba(245,183,43,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  amountLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD_LIGHT,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
