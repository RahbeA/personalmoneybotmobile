import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Share, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../api/auth';
import { requireAccount } from '../utils/requireAccount';
import { BRAND_NAME, APP_STORE_URL } from '../constants/brandCopy';

export default function MyInvitesScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (isGuest) {
      requireAccount({
        isGuest: true,
        navigation,
        feature: 'invite friends to MoneyBot',
      });
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [isGuest, navigation]);

  const load = useCallback(async () => {
    if (!token || isGuest) return;
    try {
      const data = await authApi.getMyInvites(token);
      setPayload(data);
    } catch (e) {
      Alert.alert('Could not load your invite', e.message || 'Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isGuest]);

  useEffect(() => { load(); }, [load]);

  const code = payload?.code;
  const used = payload?.used ?? 0;
  const maxUses = payload?.max_uses ?? 0;
  const remaining = payload?.remaining ?? 0;
  const reward = payload?.reward_bot_bucks ?? 0;
  const claimedBy = payload?.claimed_by || [];
  const exhausted = remaining <= 0;

  const shareInvite = useCallback(async () => {
    if (!code) return;
    const message = [
      `You're invited to ${BRAND_NAME}!`,
      '',
      `Download now and use code ${code}`,
      APP_STORE_URL,
    ].join('\n');
    try {
      // Put the App Store link in the message body so iMessage/SMS keep the
      // code AND the download URL (passing a separate `url` often drops the text).
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  }, [code]);

  const regenerate = useCallback(() => {
    Alert.alert(
      'Get a new code?',
      'Your current code will stop working and anyone with the old link won\u2019t be able to join. Friends who already joined still count.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New code',
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            try {
              const data = await authApi.regenerateInvite(token);
              setPayload(data);
            } catch (e) {
              Alert.alert('Could not regenerate', e.message || 'Try again.');
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
    );
  }, [token]);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Invite friends</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={colors.primary}
              />
            )}
          >
            {reward > 0 && (
              <View style={styles.rewardCard}>
                <View style={styles.rewardIcon}>
                  <Ionicons name="cash-outline" size={20} color={colors.background} />
                </View>
                <Text style={styles.rewardText}>
                  Earn <Text style={styles.rewardStrong}>{reward} Bot Bucks</Text> every time a friend
                  joins {BRAND_NAME} with your code.
                </Text>
              </View>
            )}

            <View style={[styles.codeCard, exhausted && styles.codeCardMuted]}>
              <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
              <Text style={styles.code}>{code}</Text>
              <View style={styles.usesRow}>
                <View style={[styles.usesBadge, exhausted ? styles.usesBadgeEmpty : styles.usesBadgeOpen]}>
                  <Ionicons
                    name={exhausted ? 'lock-closed' : 'ticket-outline'}
                    size={13}
                    color={exhausted ? '#F5B72B' : colors.primary}
                  />
                  <Text style={[styles.usesBadgeText, exhausted && styles.usesBadgeTextEmpty]}>
                    {exhausted ? 'All used up' : `${remaining} of ${maxUses} invites left`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.shareBtn, exhausted && styles.shareBtnDisabled]}
                activeOpacity={0.85}
                onPress={shareInvite}
                disabled={exhausted}
              >
                <Ionicons name="share-outline" size={18} color={colors.background} />
                <Text style={styles.shareText}>Share invite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.regenBtn}
                activeOpacity={0.7}
                onPress={regenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <ActivityIndicator color={colors.textMuted} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={15} color={colors.textMuted} />
                    <Text style={styles.regenText}>Generate a new code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.help}>
              Share your code with friends. When they create an account with it, you both get set up
              on {BRAND_NAME} and you earn Bot Bucks.
            </Text>

            {claimedBy.length > 0 && (
              <View style={styles.joinedSection}>
                <Text style={styles.joinedHeader}>
                  Joined with your code ({claimedBy.length})
                </Text>
                {claimedBy.map((entry, idx) => (
                  <View key={`${entry.name}-${idx}`} style={styles.joinedRow}>
                    <View style={styles.joinedAvatar}>
                      <Text style={styles.joinedInitial}>
                        {(entry.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.joinedName} numberOfLines={1}>{entry.name}</Text>
                    <View style={styles.joinedReward}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(61,220,95,0.12)',
    borderColor: 'rgba(61,220,95,0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
    fontWeight: '600',
  },
  rewardStrong: {
    color: colors.primary,
    fontWeight: '800',
  },
  codeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  codeCardMuted: {
    opacity: 0.8,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  code: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 6,
    color: colors.white,
    marginTop: 8,
  },
  usesRow: {
    marginTop: 12,
    marginBottom: 4,
  },
  usesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  usesBadgeOpen: {
    backgroundColor: 'rgba(61,220,95,0.16)',
  },
  usesBadgeEmpty: {
    backgroundColor: 'rgba(245,183,43,0.16)',
  },
  usesBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  usesBadgeTextEmpty: {
    color: '#F5B72B',
  },
  shareBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignSelf: 'stretch',
  },
  shareBtnDisabled: {
    opacity: 0.5,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.background,
  },
  regenBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    minHeight: 32,
  },
  regenText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  help: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  joinedSection: {
    marginTop: 24,
  },
  joinedHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  joinedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinedInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.background,
  },
  joinedName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  joinedReward: {
    width: 24,
    alignItems: 'center',
  },
});
