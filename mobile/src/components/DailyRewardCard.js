import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { secondsUntilLocalMidnight } from '../utils/localDate';
import PuckButton from './PuckButton';

const DEFAULT_TIERS = [5, 10, 15, 20, 30, 40, 75].map((bot_bucks, i) => ({ day: i + 1, bot_bucks }));
const CARD_COLOR = '#2C241E';
const CLAIM_COLOR = '#FF8A1F';

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
    <PuckButton
      color={CARD_COLOR}
      borderRadius={22}
      lip={6}
      style={styles.wrap}
      contentStyle={styles.cardContent}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PuckButton color={CLAIM_COLOR} width={36} height={36} borderRadius={12} lip={3}>
            <Ionicons name="flame" size={16} color="#fff" />
          </PuckButton>
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

      <PuckButton
        color={canClaim ? CLAIM_COLOR : '#7A8494'}
        height={52}
        borderRadius={16}
        lip={4}
        disabled={!canClaim || claiming}
        onPress={canClaim && !claiming ? onClaim : undefined}
        contentStyle={styles.claimContent}
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
      </PuckButton>
    </PuckButton>
  );
}

function makeStyles(colors, isDark) {
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return StyleSheet.create({
    wrap: { marginBottom: 22 },
    cardContent: {
      paddingVertical: 18,
      paddingHorizontal: 16,
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
      fontWeight: '800',
      color: 'rgba(255,255,255,0.7)',
      letterSpacing: 1.1,
      marginBottom: 1,
    },
    countdownBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.6)',
      borderRadius: 20,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: hairline,
    },
    countdownText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    title: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
    tierRow: { flexDirection: 'row', gap: 5, marginBottom: 16 },
    tierBox: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.5)',
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 3,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tierBoxActive: {
      borderColor: CLAIM_COLOR,
      backgroundColor: 'rgba(255,138,31,0.16)',
    },
    tierBoxNext: {
      borderColor: 'rgba(255,138,31,0.4)',
      borderStyle: 'dashed',
    },
    tierBoxPast: { opacity: 0.45 },
    tierDay: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: 0.2 },
    tierDayActive: { color: CLAIM_COLOR },
    tierAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    tierAmount: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
    tierAmountActive: { color: CLAIM_COLOR },
    claimContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    claimText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  });
}
