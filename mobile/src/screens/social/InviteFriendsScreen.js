import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader, BrandEmptyState } from '../../components/brand';
import { requireAccount } from '../../utils/requireAccount';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function InviteFriendsScreen({ navigation, route }) {
  const { groupId, groupName, excludeIds = [] } = route.params;
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const load = useCallback(async () => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    try {
      const res = await socialApi.getFriends(token);
      setFriends((res.friends || []).filter((f) => !excluded.has(f.user_id)));
    } catch (e) {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [token, excluded, isGuest]);

  useFocusEffect(useCallback(() => {
    if (isGuest) {
      requireAccount({ isGuest: true, navigation, feature: 'invite friends' });
      navigation.goBack();
      return;
    }
    setLoading(true);
    load();
  }, [load, isGuest, navigation]));

  const toggle = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSend = async () => {
    if (!requireAccount({ isGuest, navigation, feature: 'invite friends' })) return;
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await socialApi.addMembers(token, groupId, Array.from(selected));
      Alert.alert('Invites sent', 'Your friends will join once they accept.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send invites.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => (f.display_name || '').toLowerCase().includes(q));
  }, [friends, query]);

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading friends…" />
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
            <Text style={styles.title}>Invite Friends</Text>
            {!!groupName && <Text style={styles.subtitle} numberOfLines={1}>to {groupName}</Text>}
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.user_id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={(
            <BrandEmptyState
              title={friends.length === 0 ? 'No friends to invite' : 'No matches'}
              body={friends.length === 0
                ? 'Everyone you know is already in this group, or you have no friends yet.'
                : 'Try a different name.'}
            />
          )}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.user_id);
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => toggle(item.user_id)}
                activeOpacity={0.85}
              >
                <BrandAvatar character={item.equipped_character} size={44} autoRotate={!!item.equipped_character} />
                <Text style={styles.name} numberOfLines={1}>{formatName(item.display_name)}</Text>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            );
          }}
        />

        {selected.size > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.sendBtn, submitting && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnInner}
              >
                <Text style={styles.sendBtnText}>
                  {submitting ? 'Sending…' : `Send ${selected.size} Invite${selected.size === 1 ? '' : 's'}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.white, padding: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary + '88', backgroundColor: colors.primaryTint },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  footer: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  sendBtn: { borderRadius: 14, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnInner: { paddingVertical: 16, alignItems: 'center' },
  sendBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
