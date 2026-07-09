import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { secondsUntilLocalMidnight } from '../utils/localDate';

const DEFAULT_TIERS = [5, 10, 15, 20, 30, 40, 75].map((bot_bucks, i) => ({ day: i + 1, bot_bucks }));

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return 'Opens now';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 1) return `Opens in ${hours}h ${minutes}m`;
  if (minutes >= 1) return `Opens in ${minutes}m`;
  return 'Opens in <1m';
}

export default function DailyRewardCard({ dailyReward, onClaim, claiming, colors, isDark = true }) {
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntilLocalMidnight());

  useEffect(() => {
    setSecondsLeft(secondsUntilLocalMidnight());
    const id = setInterval(() => setSecondsLeft(secondsUntilLocalMidnight()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!dailyReward) return null;

  if (dailyReward.claimed_today) return null;

  const tiers = dailyReward.tiers?.length ? dailyReward.tiers : DEFAULT_TIERS;
  const currentDay = dailyReward.current_day ?? 1;
  const canClaim = dailyReward.can_claim ?? false;
  const claimAmount = dailyReward.claim_amount ?? 0;
  const claimedToday = dailyReward.claimed_today ?? false;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(255,107,53,0.08)', 'rgba(255,107,53,0)']}
        style={styles.cardAccent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        style={styles.cardSheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#FF8C42', '#FF6B35']} style={styles.headerIcon}>
            <Ionicons name="flame" size={16} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.eyebrow}>DAILY</Text>
            <Text style={styles.title}>Reward</Text>
          </View>
        </View>
        {claimedToday && (
          <View style={styles.countdownBadge}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.countdownText}>{formatCountdown(secondsLeft)}</Text>
          </View>
        )}
      </View>

      <View style={styles.tierRow}>
        {tiers.map((tier) => {
          const isDone = tier.day < currentDay;
          const isClaimable = tier.day === currentDay && canClaim;
          const isNext = tier.day === currentDay && claimedToday;
          const highlight = isClaimable || isNext;
          return (
            <View
              key={tier.day}
              style={[
                styles.tierBox,
                isClaimable && styles.tierBoxActive,
                isNext && styles.tierBoxNext,
                isDone && styles.tierBoxPast,
              ]}
            >
              <Text style={[styles.tierDay, highlight && styles.tierDayActive]}>Day {tier.day}</Text>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              ) : (
                <View style={styles.tierAmountRow}>
                  <Ionicons name="logo-bitcoin" size={11} color={highlight ? colors.streak : colors.botBucks} />
                  <Text style={[styles.tierAmount, highlight && styles.tierAmountActive]}>{tier.bot_bucks}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.claimBtn, (!canClaim || claiming) && styles.claimBtnDisabled]}
        onPress={onClaim}
        disabled={!canClaim || claiming}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={canClaim ? ['#FF8C42', '#FF6B35'] : ['#9AA4B2', '#7A8494']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.claimGrad}
        >
          {claiming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.claimText}>
                {canClaim ? `Claim ${claimAmount}` : 'Claimed today'}
              </Text>
              {canClaim && <Ionicons name="logo-bitcoin" size={17} color="#fff" />}
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors, isDark) {
  const hairline = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: hairline,
      marginBottom: 28,
      overflow: 'hidden',
      position: 'relative',
      ...CARD_SHADOW,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    cardSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 1,
    },
    countdownBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
      borderRadius: 20,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: hairline,
    },
    countdownText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
    tierRow: { flexDirection: 'row', gap: 5, marginBottom: 16 },
    tierBox: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 3,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tierBoxActive: {
      borderColor: '#FF6B35',
      backgroundColor: 'rgba(255,107,53,0.1)',
    },
    tierBoxNext: {
      borderColor: 'rgba(255,107,53,0.4)',
      borderStyle: 'dashed',
    },
    tierBoxPast: { opacity: 0.45 },
    tierDay: { fontSize: 8, fontWeight: '700', color: colors.textMuted, marginBottom: 4, letterSpacing: 0.2 },
    tierDayActive: { color: '#FF6B35' },
    tierAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    tierAmount: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
    tierAmountActive: { color: '#FF6B35' },
    claimBtn: { borderRadius: 16, overflow: 'hidden', ...CARD_SHADOW },
    claimBtnDisabled: { opacity: 0.85, shadowOpacity: 0.15 },
    claimGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
    },
    claimText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  });
}
