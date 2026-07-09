import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_TIP = 'Needs = essentials (rent, food). Wants = fun stuff. Savings = future you.';

export default function GameOverModal({
  visible,
  score,
  xpEarned,
  botBucksEarned = 0,
  isBest,
  correctCount,
  wrongCount,
  stats,
  tip = DEFAULT_TIP,
  onPlayAgain,
  onExit,
  loading,
  colors,
}) {
  const styles = makeStyles(colors);

  // Games can pass a custom `stats` array; otherwise fall back to the
  // correct/wrong layout used by Budget Blitz. XP + Bot Bucks are shown
  // separately in the reward row below so every game surfaces the payout.
  const statItems = stats || [
    { icon: 'checkmark-circle', color: colors.primary, value: correctCount, label: 'Correct' },
    { icon: 'close-circle', color: '#FF6B6B', value: wrongCount, label: 'Wrong' },
  ];

  const earnedNothing = !xpEarned && !botBucksEarned;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(61,220,95,0.2)', 'rgba(61,220,95,0.04)']}
            style={styles.cardGradient}
          >
            <Text style={styles.title}>Time's Up!</Text>

            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreLabel}>points</Text>
            </View>

            {isBest && (
              <View style={styles.bestBadge}>
                <Ionicons name="trophy" size={14} color="#F5B72B" />
                <Text style={styles.bestText}>New personal best! +bonus</Text>
              </View>
            )}

            {/* Reward payout */}
            {earnedNothing ? (
              <Text style={styles.noReward}>Score higher next time to earn XP &amp; Bot Bucks</Text>
            ) : (
              <View style={styles.rewardRow}>
                <View style={styles.rewardPill}>
                  <Ionicons name="flash" size={16} color={colors.primary} />
                  <Text style={styles.rewardValue}>+{xpEarned}</Text>
                  <Text style={styles.rewardLabel}>XP</Text>
                </View>
                <View style={styles.rewardPill}>
                  <Ionicons name="logo-bitcoin" size={16} color="#F5B72B" />
                  <Text style={[styles.rewardValue, { color: '#F5B72B' }]}>+{botBucksEarned}</Text>
                  <Text style={styles.rewardLabel}>Bucks</Text>
                </View>
              </View>
            )}

            <View style={styles.statsRow}>
              {statItems.map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && <View style={styles.statDivider} />}
                  <View style={styles.statItem}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                    <Text style={styles.statVal}>{item.value}</Text>
                    <Text style={styles.statLbl}>{item.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={styles.tip}>{tip}</Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={onPlayAgain}
              disabled={loading}
            >
              <LinearGradient
                colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnGrad}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{loading ? 'Starting...' : 'Play Again'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={onExit}>
              <Text style={styles.secondaryBtnText}>Back to Arcade</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGradient: { padding: 28, alignItems: 'center' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: -2,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,183,43,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  bestText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5B72B',
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rewardValue: { fontSize: 17, fontWeight: '800', color: colors.primary },
  rewardLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  noReward: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 18,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.white },
  statLbl: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  tip: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  primaryBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  primaryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
