import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { BrandAvatar } from '../components/brand';
import BadgeIcon from '../components/BadgeIcon';
import { CELEBRATIONS } from '../constants/brandCopy';

const MODULE_BADGES = {
  1: 'module_1', 2: 'module_2', 3: 'module_3', 4: 'module_4', 5: 'module_5',
};

export default function ModuleCompleteScreen({ navigation, route }) {
  const { module, badge, xp, moneyChatBonus } = route.params;
  const { equippedCharacter, getBadgeMeta } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const badgeKey = badge || MODULE_BADGES[module.order];
  const badgeMeta = getBadgeMeta(badgeKey);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ringsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, delay: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
      Animated.timing(ringsAnim, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.ring,
                styles.ringOuter,
                {
                  opacity: ringsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
                  transform: [{ scale: ringsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                styles.ringInner,
                {
                  opacity: ringsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
                  transform: [{ scale: ringsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
                },
              ]}
            />

            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              <BrandAvatar character={equippedCharacter} size={100} autoRotate={!!equippedCharacter} logoSize={64} />
            </Animated.View>

            <Animated.View
              style={[
                styles.badge,
                {
                  position: 'absolute',
                  bottom: -8,
                  right: -8,
                  transform: [
                    { scale: scaleAnim },
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['-15deg', '5deg', '0deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('BadgeReveal', {
                badgeKey,
                mode: 'view',
                earned: true,
              })}
            >
              <View style={styles.badgeGrad}>
                <BadgeIcon badge={badgeMeta} size={40} />
              </View>
            </TouchableOpacity>
            </Animated.View>
          </View>

          <Text style={styles.moduleLabel}>{module.title}</Text>
          <Text style={styles.title}>Module Complete!</Text>
          <Text style={styles.subtitle}>{CELEBRATIONS.moduleComplete}</Text>
          <View style={[styles.badgeNameChip, { backgroundColor: badgeMeta.color + '22', borderColor: badgeMeta.color + '44' }]}>
            <Text style={[styles.badgeName, { color: badgeMeta.color }]}>{badgeMeta.label}</Text>
          </View>

          <Text style={styles.badgeUnlockText}>Badge unlocked</Text>

          <View style={styles.statsWrap}>
            <View style={styles.xpChip}>
              <Text style={styles.xpVal}>+{xp || 0}</Text>
              <Text style={styles.xpLbl}>XP from this module</Text>
            </View>
          </View>

          {moneyChatBonus && (
            <View style={styles.bonusChip}>
              <Ionicons name="sparkles" size={16} color="#F5B72B" />
              <Text style={styles.bonusText}>
                Money Chat passed: +{moneyChatBonus.xp} XP, +{moneyChatBonus.bot_bucks} Bot Bucks
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CourseMap')}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.continueBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 180, height: 180 },
  ring: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: colors.primary,
  },
  ringOuter: { width: 180, height: 180, borderRadius: 90 },
  ringInner: { width: 140, height: 140, borderRadius: 70 },
  badge: {},
  badgeGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 48 },
  moduleLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: colors.white, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 10 },
  badgeNameChip: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1, marginBottom: 6,
  },
  badgeName: { fontSize: 18, fontWeight: '800' },
  badgeUnlockText: { fontSize: 13, color: colors.textMuted, marginBottom: 28 },
  statsWrap: {},
  xpChip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 20,
    paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  xpVal: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  xpLbl: { fontSize: 13, color: colors.textMuted },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    backgroundColor: 'rgba(245,183,43,0.12)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.32)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
  },
  bonusText: { fontSize: 13, fontWeight: '700', color: '#F5B72B' },
  footer: { paddingBottom: 16 },
  continueBtn: { borderRadius: 18, overflow: 'hidden' },
  continueBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: 18,
  },
  continueBtnText: { fontSize: 17, fontWeight: '800', color: colors.background },
});
