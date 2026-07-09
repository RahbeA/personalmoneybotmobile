import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import { GroupIcon } from './groupIcons';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function GroupDetailScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { token, user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [group, setGroup] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [leaderPreview, setLeaderPreview] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [groupRes, challengesRes, lbRes] = await Promise.all([
        socialApi.getGroup(token, groupId),
        socialApi.getChallenges(token, groupId),
        socialApi.getGroupLeaderboard(token, groupId),
      ]);
      setGroup(groupRes);
      setChallenges(challengesRes.challenges || []);
      setLeaderPreview((lbRes.top || []).slice(0, 3));
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load group.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [token, groupId, navigation]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const isOwner = group?.owner_id === user?.id;

  const openInvitePage = () => {
    const memberIds = (group?.members || []).map((m) => m.user_id);
    const invitedIds = (group?.pending_invites || []).map((i) => i.user_id);
    navigation.navigate('InviteFriends', {
      groupId,
      groupName: group?.name,
      excludeIds: [...memberIds, ...invitedIds],
    });
  };

  const handleCancelInvite = (invite) => {
    Alert.alert('Cancel invite', `Cancel the invite to ${formatName(invite.display_name)}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel invite',
        style: 'destructive',
        onPress: async () => {
          try {
            await socialApi.cancelGroupInvite(token, groupId, invite.invite_id);
            await load();
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not cancel invite.');
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert(
      isOwner ? 'Delete / leave group' : 'Leave group',
      isOwner
        ? 'If you are the only member, the group will be deleted.'
        : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Leave' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialApi.leaveGroup(token, groupId, user.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not leave group.');
            }
          },
        },
      ],
    );
  };

  if (loading || !group) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading group…" />
      </LinearGradient>
    );
  }

  const members = group.members || [];
  const pendingInvites = group.pending_invites || [];

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>{group.name}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLeave} activeOpacity={0.85}>
            <Ionicons name="exit-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <GroupIcon iconKey={group.emoji} size={34} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>{group.name}</Text>
            <Text style={styles.heroSub}>
              {members.length} member{members.length !== 1 ? 's' : ''}
              {pendingInvites.length ? ` · ${pendingInvites.length} pending` : ''}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryAction}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('GroupLeaderboard', { groupId, groupName: group.name })}
            >
              <Ionicons name="stats-chart" size={18} color={colors.primary} />
              <Text style={styles.secondaryActionText}>Ranking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              activeOpacity={0.85}
              onPress={openInvitePage}
            >
              <Ionicons name="person-add" size={18} color={colors.primary} />
              <Text style={styles.secondaryActionText}>Invite</Text>
            </TouchableOpacity>
          </View>

          {leaderPreview.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="trophy" size={16} color={colors.botBucks} />
                <Text style={styles.cardTitle}>Top by XP</Text>
              </View>
              {leaderPreview.map((entry) => (
                <View key={entry.user_id} style={styles.lbRow}>
                  <Text style={styles.lbRank}>#{entry.rank}</Text>
                  <BrandAvatar character={entry.equipped_character} size={30} />
                  <Text style={styles.lbName} numberOfLines={1}>{formatName(entry.display_name)}</Text>
                  <Text style={styles.lbScore}>{entry.xp} XP</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>CHALLENGES</Text>
            <TouchableOpacity
              style={styles.newChallengeBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CreateChallenge', { groupId })}
            >
              <Ionicons name="add" size={16} color={colors.background} />
              <Text style={styles.newChallengeText}>New</Text>
            </TouchableOpacity>
          </View>
          {challenges.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CreateChallenge', { groupId })}
            >
              <View style={styles.emptyPlus}>
                <Ionicons name="add" size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No challenges yet. Tap to create the first one!</Text>
            </TouchableOpacity>
          ) : (
            challenges.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.challengeCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ChallengeLeaderboard', { challengeId: c.id })}
              >
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeTitle} numberOfLines={1}>{c.title}</Text>
                  <View style={[styles.stateBadge, c.state === 'active' && styles.stateActive]}>
                    <Text style={[styles.stateText, c.state === 'active' && styles.stateTextActive]}>
                      {c.state}
                    </Text>
                  </View>
                </View>
                <Text style={styles.challengeMeta}>
                  {c.metric_label} · target {c.target} · ends {formatDate(c.ends_at)}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>MEMBERS</Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>
          {members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <BrandAvatar character={m.equipped_character} size={40} />
              <View style={styles.memberBody}>
                <Text style={styles.memberName}>{formatName(m.display_name)}</Text>
                <Text style={styles.memberRole}>{m.role}</Text>
              </View>
              {m.role === 'owner' && (
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              )}
            </View>
          ))}

          {pendingInvites.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>PENDING INVITES</Text>
                <Text style={styles.sectionCount}>{pendingInvites.length}</Text>
              </View>
              {pendingInvites.map((inv) => (
                <View key={inv.invite_id} style={styles.inviteRow}>
                  <BrandAvatar character={inv.equipped_character} size={36} />
                  <View style={styles.memberBody}>
                    <Text style={styles.memberName}>{formatName(inv.display_name)}</Text>
                    <Text style={styles.memberRole}>Waiting to accept</Text>
                  </View>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={() => handleCancelInvite(inv)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.white, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary + '44',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  secondaryAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surfaceElevated, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryActionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  card: {
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.white },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  lbRank: { width: 26, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  lbName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },
  lbScore: { fontSize: 13, fontWeight: '800', color: colors.primary },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, marginBottom: 10,
  },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6 },
  sectionCount: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  newChallengeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  newChallengeText: { fontSize: 13, fontWeight: '800', color: colors.background },
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: colors.primary + '44', borderStyle: 'dashed',
  },
  emptyPlus: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary + '44',
  },
  emptyText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  challengeCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  challengeTitle: { fontSize: 15, fontWeight: '800', color: colors.white, flex: 1 },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.surface },
  stateActive: { backgroundColor: colors.primaryTint },
  stateText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  stateTextActive: { color: colors.primary },
  challengeMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  memberBody: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.white },
  memberRole: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
});
