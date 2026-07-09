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
import { BrandLoader, BrandEmptyState } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { GroupIcon } from './groupIcons';

export default function GroupsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabInset = useTabBarInset(24);

  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [groupsRes, invitesRes] = await Promise.all([
        socialApi.getGroups(token),
        socialApi.getGroupInvites(token),
      ]);
      setGroups(groupsRes.groups || []);
      setInvites(invitesRes.invites || []);
    } catch (e) {
      setGroups([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const handleAcceptInvite = async (inviteId) => {
    setActionId(inviteId);
    try {
      await socialApi.acceptGroupInvite(token, inviteId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not accept invite.');
    } finally {
      setActionId(null);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    setActionId(inviteId);
    try {
      await socialApi.declineGroupInvite(token, inviteId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not decline invite.');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading groups…" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.subtitle}>{groups.length} group{groups.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateGroup')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color={colors.background} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
          showsVerticalScrollIndicator={false}
        >
          {invites.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>INVITATIONS</Text>
              {invites.map((inv) => (
                <View key={inv.invite_id} style={styles.inviteCard}>
                  <View style={styles.groupIconWrap}>
                    <GroupIcon iconKey={inv.group.emoji} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.groupBody}>
                    <Text style={styles.groupName} numberOfLines={1}>{inv.group.name}</Text>
                    <Text style={styles.groupMeta}>Invited by {inv.invited_by}</Text>
                  </View>
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptInvite(inv.invite_id)}
                      disabled={actionId === inv.invite_id}
                    >
                      <Ionicons name="checkmark" size={18} color={colors.background} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDeclineInvite(inv.invite_id)}
                      disabled={actionId === inv.invite_id}
                    >
                      <Ionicons name="close" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <Text style={styles.sectionLabel}>YOUR GROUPS</Text>
            </>
          )}

          {groups.length === 0 ? (
            <BrandEmptyState
              title="No groups yet"
              body="Create a group and invite your friends to compete together."
              style={styles.empty}
            />
          ) : (
            groups.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.groupCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
              >
                <View style={styles.groupIconWrap}>
                  <GroupIcon iconKey={item.emoji} size={26} color={colors.primary} />
                </View>
                <View style={styles.groupBody}>
                  <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.groupMeta}>
                    {item.member_count} member{item.member_count !== 1 ? 's' : ''}
                    {item.active_challenge ? ` · ${item.active_challenge.title}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerBody: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  createBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.6, marginTop: 8, marginBottom: 10,
  },
  empty: { marginTop: 24 },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.primary + '66',
  },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  groupIconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary + '44',
  },
  groupBody: { flex: 1, minWidth: 0 },
  groupName: { fontSize: 16, fontWeight: '800', color: colors.white },
  groupMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
