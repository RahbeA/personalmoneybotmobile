import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
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
import { GROUP_ICON_OPTIONS, GroupIcon } from './groupIcons';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function CreateGroupScreen({ navigation }) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('people');
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!token) return;
    socialApi.getFriends(token)
      .then((res) => setFriends(res.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [token]));

  const toggleFriend = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your group a name.');
      return;
    }
    setSubmitting(true);
    try {
      const group = await socialApi.createGroup(token, {
        name: name.trim(),
        emoji,
        memberIds: Array.from(selected),
      });
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create group.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <Text style={styles.title}>Create Group</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.previewCard}>
            <LinearGradient
              colors={[colors.primaryTint, colors.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewGlow}
            >
              <View style={styles.previewIcon}>
                <GroupIcon iconKey={emoji} size={34} color={colors.primary} />
              </View>
            </LinearGradient>
            <Text style={styles.previewName} numberOfLines={1}>
              {name.trim() || 'Your Group'}
            </Text>
            <Text style={styles.previewMeta}>
              {selected.size > 0
                ? `${selected.size + 1} member${selected.size + 1 !== 1 ? 's' : ''} to start`
                : 'Just you for now'}
            </Text>
          </View>

          <Text style={styles.label}>GROUP NAME</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Finance Squad"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <Text style={styles.counter}>{name.length}/80</Text>
          </View>

          <Text style={styles.label}>PICK AN ICON</Text>
          <View style={styles.emojiRow}>
            {GROUP_ICON_OPTIONS.map((option) => {
              const active = emoji === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.emojiBtn, active && styles.emojiBtnActive]}
                  onPress={() => setEmoji(option.key)}
                  activeOpacity={0.85}
                >
                  <GroupIcon
                    iconKey={option.key}
                    size={24}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  {active && (
                    <View style={styles.emojiCheck}>
                      <Ionicons name="checkmark" size={11} color={colors.background} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inviteHeader}>
            <Text style={[styles.label, styles.inviteLabel]}>INVITE FRIENDS</Text>
            {selected.size > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{selected.size} selected</Text>
              </View>
            )}
          </View>
          <Text style={styles.hint}>Friends you select will be invited and join once they accept.</Text>

          {friends.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyText}>Add friends first before creating a group.</Text>
            </View>
          ) : (
            friends.map((friend) => {
              const isSelected = selected.has(friend.user_id);
              return (
                <TouchableOpacity
                  key={friend.user_id}
                  style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                  onPress={() => toggleFriend(friend.user_id)}
                  activeOpacity={0.85}
                >
                  <BrandAvatar character={friend.equipped_character} size={40} />
                  <Text style={styles.friendName}>{formatName(friend.display_name)}</Text>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitText}>{submitting ? 'Creating…' : 'Create Group'}</Text>
            </LinearGradient>
          </TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: '900', color: colors.white },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  previewCard: {
    alignItems: 'center', marginTop: 8, marginBottom: 4, paddingVertical: 20,
  },
  previewGlow: {
    width: 92, height: 92, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary + '55',
  },
  previewIcon: {
    width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background + 'cc',
  },
  previewName: {
    fontSize: 20, fontWeight: '900', color: colors.white, marginTop: 14, letterSpacing: -0.3,
  },
  previewMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  label: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
  },
  input: {
    flex: 1, paddingVertical: 14, fontSize: 16, color: colors.white,
  },
  counter: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginLeft: 8 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  emojiCheck: {
    position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteLabel: { marginBottom: 4 },
  countPill: {
    backgroundColor: colors.primaryTint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.primary + '55', marginTop: 16,
  },
  countPillText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  emptyCard: {
    alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 16,
    backgroundColor: colors.surfaceElevated, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  friendRowSelected: { borderColor: colors.primary + '88', backgroundColor: colors.primaryTint },
  friendName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  submitBtn: { marginTop: 28, borderRadius: 16, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
