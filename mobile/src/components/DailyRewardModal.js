import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { secondsUntilLocalMidnight } from '../utils/localDate';
import PuckButton from './PuckButton';

const DEFAULT_TIERS = [5, 10, 15, 20, 30, 40, 75].map((bot_bucks, i) => ({ day: i + 1, bot_bucks }));
const CLAIM_COLOR = '#FF8A1F';

function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return 'Opens now';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 1) return `Opens in ${hours}h ${minutes}m`;
  if (minutes >= 1) return `Opens in ${minutes}m`;
  return 'Opens in <1m';
}

export default function DailyRewardModal({
  visible,
  dailyReward,
  onClaim,
  claiming,
  onDismiss,
  colors,
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntilLocalMidnight());

  useEffect(() => {
    if (!visible) return undefined;
    setSecondsLeft(secondsUntilLocalMidnight());
    const id = setInterval(() => setSecondsLeft(secondsUntilLocalMidnight()), 60000);
    return () => clearInterval(id);
  }, [visible]);

  if (!dailyReward) return null;

  const tiers = dailyReward.tiers?.length ? dailyReward.tiers : DEFAULT_TIERS;
  const currentDay = dailyReward.current_day ?? 1;
  const canClaim = dailyReward.can_claim ?? false;
  const claimAmount = dailyReward.claim_amount ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.flame}>
            <Ionicons name="flame" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.kicker}>STREAK REWARD</Text>
          <Text style={styles.title}>Keep the fire going</Text>
          <Text style={styles.body}>
            Claim today&apos;s Bot Bucks so your streak stays clean.
          </Text>

          <View style={styles.tierRow}>
            {tiers.map((tier) => {
              const isDone = tier.day < currentDay;
              const isClaimable = tier.day === currentDay && canClaim;
              return (
                <View
                  key={tier.day}
                  style={[
                    styles.tierBox,
                    isClaimable && styles.tierBoxActive,
                    isDone && styles.tierBoxPast,
                  ]}
                >
                  <Text style={[styles.tierDay, isClaimable && styles.tierDayActive]}>
                    D{tier.day}
                  </Text>
                  {isDone ? (
                    <Ionicons name="checkmark" size={13} color={colors.primary} />
                  ) : (
                    <Text style={[styles.tierAmount, isClaimable && styles.tierAmountActive]}>
                      {tier.bot_bucks}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          <PuckButton
            color={canClaim ? CLAIM_COLOR : '#7A8494'}
            height={54}
            borderRadius={16}
            lip={5}
            disabled={!canClaim || claiming}
            onPress={canClaim && !claiming ? onClaim : undefined}
            contentStyle={styles.claimInner}
          >
            {claiming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.claimText}>
                  {canClaim ? `Claim ${claimAmount}` : 'Claimed today'}
                </Text>
                {canClaim ? <Ionicons name="logo-bitcoin" size={17} color="#fff" /> : null}
              </>
            )}
          </PuckButton>

          <Pressable onPress={onDismiss} hitSlop={10} style={styles.laterBtn}>
            <Text style={styles.laterText}>
              {canClaim ? 'Later' : formatCountdown(secondsLeft)}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 18, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,138,31,0.35)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: 'center',
  },
  flame: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: CLAIM_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: CLAIM_COLOR,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  tierRow: { flexDirection: 'row', gap: 5, marginBottom: 18, width: '100%' },
  tierBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierBoxActive: {
    borderColor: CLAIM_COLOR,
    backgroundColor: 'rgba(255,138,31,0.16)',
  },
  tierBoxPast: { opacity: 0.4 },
  tierDay: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.45)', marginBottom: 3 },
  tierDayActive: { color: CLAIM_COLOR },
  tierAmount: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)' },
  tierAmountActive: { color: CLAIM_COLOR },
  claimInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  claimText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  laterBtn: { paddingVertical: 12 },
  laterText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
