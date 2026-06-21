import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function DailyRewardCard({ dailyReward, botBucks, onClaim, claiming, colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!dailyReward?.tiers?.length) return null;

  const { tiers, current_day: currentDay, can_claim: canClaim, claim_amount: claimAmount, claimed_today: claimedToday } = dailyReward;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flame" size={18} color="#fff" />
        </View>
        <Text style={styles.title}>Daily Reward</Text>
      </View>

      <View style={styles.tierRow}>
        {tiers.map((tier) => {
          const isCurrent = tier.day === currentDay && !claimedToday;
          const isPast = tier.day < currentDay || (claimedToday && tier.day === currentDay);
          return (
            <View
              key={tier.day}
              style={[
                styles.tierBox,
                isCurrent && styles.tierBoxActive,
                isPast && styles.tierBoxPast,
              ]}
            >
              <Text style={[styles.tierDay, isCurrent && styles.tierDayActive]}>Day {tier.day}</Text>
              <View style={styles.tierAmountRow}>
                <Ionicons name="logo-bitcoin" size={12} color={isCurrent ? colors.streak : colors.botBucks} />
                <Text style={[styles.tierAmount, isCurrent && styles.tierAmountActive]}>{tier.bot_bucks}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.claimBtn, (!canClaim || claiming) && styles.claimBtnDisabled]}
        onPress={onClaim}
        disabled={!canClaim || claiming}
        activeOpacity={0.85}
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
              {canClaim && <Ionicons name="logo-bitcoin" size={18} color="#fff" />}
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#FF6B35',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.white },
    tierRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    tierBox: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tierBoxActive: {
      borderColor: '#FF6B35',
      backgroundColor: 'rgba(255,107,53,0.08)',
    },
    tierBoxPast: { opacity: 0.55 },
    tierDay: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
    tierDayActive: { color: '#FF6B35' },
    tierAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    tierAmount: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
    tierAmountActive: { color: '#FF6B35' },
    claimBtn: { borderRadius: 14, overflow: 'hidden' },
    claimBtnDisabled: { opacity: 0.85 },
    claimGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    claimText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  });
}
