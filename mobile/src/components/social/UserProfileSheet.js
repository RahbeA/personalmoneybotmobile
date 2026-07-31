import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getRankMeta } from '../../context/UserProgressContext';
import { socialApi } from '../../api/social';
import { BrandAvatar } from '../brand';
import { requireAccount } from '../../utils/requireAccount';
import { localDate } from '../../utils/localDate';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function UserProfileSheet({
  visible,
  userId,
  seed = null,
  onClose,
  navigation,
  onChanged,
}) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [profile, setProfile] = useState(seed);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !userId || isGuest) return;
    setLoading(true);
    try {
      const data = await socialApi.getUserProfile(token, userId);
      setProfile(data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load profile.');
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [token, userId, isGuest, onClose]);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    setProfile(seed || { user_id: userId });
    if (!isGuest) load();
    return undefined;
  }, [visible, userId, seed, isGuest, load]);

  const rankMeta = getRankMeta(profile?.rank_tier?.key);

  async function handleSendRequest() {
    if (!requireAccount({ isGuest, navigation, feature: 'send friend requests' })) return;
    setActing(true);
    try {
      await socialApi.sendRequest(token, userId);
      await load();
      onChanged?.();
      Alert.alert('Sent', 'Friend request sent!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send request.');
    } finally {
      setActing(false);
    }
  }

  async function handleAccept() {
    if (!profile?.request_id) return;
    if (!requireAccount({ isGuest, navigation, feature: 'accept friend requests' })) return;
    setActing(true);
    try {
      await socialApi.acceptRequest(token, profile.request_id);
      await load();
      onChanged?.();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not accept request.');
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    if (!profile?.request_id) return;
    if (!requireAccount({ isGuest, navigation, feature: 'manage friend requests' })) return;
    setActing(true);
    try {
      await socialApi.declineRequest(token, profile.request_id);
      await load();
      onChanged?.();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not decline request.');
    } finally {
      setActing(false);
    }
  }

  function handleRemove() {
    if (!requireAccount({ isGuest, navigation, feature: 'manage friends' })) return;
    Alert.alert(
      'Remove friend',
      `Remove ${formatName(profile?.display_name)} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await socialApi.removeFriend(token, userId);
              await load();
              onChanged?.();
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not remove friend.');
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  }

  async function handleNudge() {
    if (!requireAccount({ isGuest, navigation, feature: 'nudge friends' })) return;
    setActing(true);
    try {
      await socialApi.nudgeFriend(token, userId, localDate());
      setProfile((prev) => (prev ? { ...prev, can_nudge: false } : prev));
      onChanged?.();
      Alert.alert(
        'Nudge sent!',
        `${formatName(profile?.display_name)} will get a push to hop back on MoneyBot.`,
      );
    } catch (e) {
      const msg = e.message || 'Could not send nudge.';
      Alert.alert(e.code === 'nudge_limit' ? 'Already nudged' : 'Error', msg);
      if (e.code === 'nudge_limit' || /already nudged/i.test(msg)) {
        setProfile((prev) => (prev ? { ...prev, can_nudge: false } : prev));
      }
    } finally {
      setActing(false);
    }
  }

  function renderAction() {
    if (!profile || profile.is_me) {
      return (
        <View style={styles.youPill}>
          <Text style={styles.youPillText}>This is you</Text>
        </View>
      );
    }

    if (isGuest) {
      return (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => requireAccount({ isGuest: true, navigation, feature: 'add friends' })}>
          <Text style={styles.primaryBtnText}>Create account to add friends</Text>
        </TouchableOpacity>
      );
    }

    if (profile.friendship_status === 'accepted') {
      return (
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, !profile.can_nudge && styles.primaryBtnDisabled]}
            onPress={handleNudge}
            disabled={acting || profile.can_nudge === false}
          >
            {acting ? <ActivityIndicator color={colors.background} /> : (
              <>
                <Ionicons name="hand-left" size={18} color={colors.background} />
                <Text style={styles.primaryBtnText}>
                  {profile.can_nudge === false ? 'Nudged today' : 'Nudge'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleRemove} disabled={acting}>
            <Ionicons name="person-remove-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.secondaryBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (profile.friendship_status === 'pending' && profile.friendship_direction === 'outgoing') {
      return (
        <View style={styles.pendingPill}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.pendingPillText}>Request pending</Text>
        </View>
      );
    }

    if (profile.friendship_status === 'pending' && profile.friendship_direction === 'incoming') {
      return (
        <View style={styles.incomingRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnFlex]}
            onPress={handleAccept}
            disabled={acting}
          >
            {acting ? <ActivityIndicator color={colors.background} /> : (
              <Text style={styles.primaryBtnText}>Accept request</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={acting}>
            <Ionicons name="close" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSendRequest} disabled={acting}>
        {acting ? <ActivityIndicator color={colors.background} /> : (
          <>
            <Ionicons name="person-add" size={18} color={colors.background} />
            <Text style={styles.primaryBtnText}>Add friend</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          {loading && !profile?.display_name ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <>
              <View style={styles.avatarRing}>
                <BrandAvatar
                  character={profile?.equipped_character}
                  size={88}
                  autoRotate={!!profile?.equipped_character}
                />
              </View>
              <Text style={styles.name}>{formatName(profile?.display_name)}</Text>
              {!!profile?.rank_tier?.label && (
                <View style={styles.tierChip}>
                  <Ionicons name={rankMeta.ionIcon} size={12} color={rankMeta.color} />
                  <Text style={[styles.tierText, { color: rankMeta.color }]}>
                    {profile.rank_tier.label}
                  </Text>
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>
                    {(profile?.literacy_points ?? profile?.xp ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.statLbl}>Points</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{(profile?.xp ?? 0).toLocaleString()}</Text>
                  <Text style={styles.statLbl}>XP</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{profile?.streak_days ?? 0}</Text>
                  <Text style={styles.statLbl}>Streak</Text>
                </View>
              </View>

              <View style={styles.actionWrap}>{renderAction()}</View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors, isDark) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay || 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    marginBottom: 18,
  },
  avatarRing: {
    borderRadius: 52,
    borderWidth: 2,
    borderColor: colors.primaryTintStrong,
    padding: 3,
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 18,
  },
  tierText: { fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 20,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.white },
  statLbl: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  actionWrap: { width: '100%', marginBottom: 8 },
  friendActions: { width: '100%', gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  // Only inside the incoming-request row, where the button shares space with decline.
  primaryBtnFlex: { flex: 1 },
  primaryBtnDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.7,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingPillText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  youPill: {
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  youPillText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  incomingRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  declineBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
