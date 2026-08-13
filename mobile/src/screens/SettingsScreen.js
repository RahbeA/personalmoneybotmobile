import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  Switch, Alert, ActivityIndicator, Linking, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress, getRankMeta } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { BrandHeader, BrandAvatar } from '../components/brand';
import { LEGAL } from '../constants/legal';
import { GOALS } from '../constants/goals';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
  areNotificationsSupported,
  getNotificationsUnavailableMessage,
} from '../utils/notifications';
import { getFirstName } from '../utils/displayName';
import { localDate } from '../utils/localDate';

function LinkTile({ icon, label, onPress, colors, styles }) {
  return (
    <TouchableOpacity style={styles.linkTile} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.linkTileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { user, isGuest, updateProfile, logout, deleteAccount } = useAuth();
  const {
    xp, streakDays, lastActive, level, lessonsCompleted, botBucks, equippedCharacter, rank,
    onboardingGoals, updateGoals,
  } = useUserProgress();
  const rankMeta = getRankMeta(rank?.key);
  const { colors, isDark, toggleTheme } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [notifPrefs, setNotifPrefs] = useState({ daily: true, streak: true, newContent: false });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSyncing, setNotifSyncing] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Profile name editing
  const [profileOpen, setProfileOpen] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Goals editing
  const [savingGoalKey, setSavingGoalKey] = useState(null);
  const selectedGoals = onboardingGoals || [];

  const notifSupported = areNotificationsSupported();

  const displayName = getFirstName(user);
  const emailDisplay = isGuest ? 'Guest — progress saved on this device' : (user?.email || '');

  function goToCreateAccount() {
    const rootNav = navigation.getParent?.() ?? navigation;
    rootNav.navigate('AuthUpgrade', { mode: 'register' });
  }

  function openProfileEditor() {
    const parts = (user?.name || '').trim().split(/\s+/);
    setEditFirst(parts[0] || '');
    setEditLast(parts.slice(1).join(' ') || '');
    setProfileError('');
    setProfileOpen(true);
  }

  async function saveProfile() {
    if (!editFirst.trim()) {
      setProfileError('Please enter your first name.');
      return;
    }
    setProfileError('');
    setSavingProfile(true);
    const fullName = `${editFirst.trim()} ${editLast.trim()}`.trim();
    try {
      await updateProfile({ name: fullName });
      setProfileOpen(false);
    } catch (err) {
      setProfileError(err.message || 'Could not save. Try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  const toggleGoal = useCallback(async (key) => {
    if (savingGoalKey) return;
    const next = selectedGoals.includes(key)
      ? selectedGoals.filter((g) => g !== key)
      : [...selectedGoals, key];
    setSavingGoalKey(key);
    try {
      await updateGoals(next);
    } catch (err) {
      Alert.alert('Could Not Update', err.message || 'Try again in a moment.');
    } finally {
      setSavingGoalKey(null);
    }
  }, [savingGoalKey, selectedGoals, updateGoals]);

  function openLegal(document) {
    const rootNav = navigation.getParent?.() ?? navigation;
    rootNav.navigate('Legal', { document });
  }

  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      setNotifPrefs(prefs);
      setNotifLoading(false);
    });
  }, []);

  const notifOn = notifPrefs.daily || notifPrefs.streak || notifPrefs.newContent;

  const toggleNotifications = useCallback(async (value) => {
    if (!notifSupported) {
      Alert.alert('Rebuild Required', getNotificationsUnavailableMessage());
      return;
    }
    const previous = notifPrefs;
    const next = { daily: value, streak: value, newContent: value };
    setNotifPrefs(next);
    setNotifSyncing(true);
    try {
      await saveNotificationPrefs(next);
      const streakContext = {
        firstName: getFirstName(user),
        streakDays,
        activeToday: lastActive === localDate(),
      };
      const result = await syncNotificationSchedule(next, streakContext);
      if (!result.ok && result.reason === 'permission_denied') {
        Alert.alert(
          'Notifications Off',
          'Enable notifications in your device Settings to receive reminders.',
        );
        const reverted = { daily: false, streak: false, newContent: false };
        setNotifPrefs(reverted);
        await saveNotificationPrefs(reverted);
      }
    } catch (err) {
      Alert.alert('Could Not Update', err.message || 'Try again in a moment.');
      setNotifPrefs(previous);
    } finally {
      setNotifSyncing(false);
    }
  }, [notifPrefs, notifSupported, user, streakDays, lastActive]);

  function confirmLogout() {
    if (isGuest) {
      Alert.alert(
        'Leave Guest Session?',
        'You\u2019re using a guest account. Signing out will permanently erase your progress on this device. Create a free account to save it first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Account', onPress: goToCreateAccount },
          { text: 'Sign Out Anyway', style: 'destructive', onPress: logout },
        ],
      );
      return;
    }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all progress. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount();
            } catch (err) {
              Alert.alert('Error', err.message || 'Something went wrong.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader title="Profile" />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Profile hero */}
          <LinearGradient
            colors={['rgba(61,220,95,0.16)', 'rgba(61,220,95,0.04)']}
            style={styles.heroCard}
          >
            <TouchableOpacity
              style={styles.heroEditBtn}
              activeOpacity={0.8}
              onPress={openProfileEditor}
              accessibilityLabel="Edit name"
            >
              <Ionicons name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
            <BrandAvatar character={equippedCharacter} size={72} autoRotate={!!equippedCharacter} />
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroEmail}>{emailDisplay}</Text>
            <View style={styles.chipRow}>
              {rank && (
                <View style={[styles.chip, { borderColor: rankMeta.color + '55', backgroundColor: rankMeta.color + '1A' }]}>
                  <Ionicons name={rankMeta.ionIcon} size={12} color={rankMeta.color} />
                  <Text style={[styles.chipText, { color: rankMeta.color }]}>{rank.label}</Text>
                </View>
              )}
              <View style={styles.chip}>
                <Text style={[styles.chipText, { color: colors.primary }]}>Lv {level}</Text>
              </View>
            </View>

            <View style={styles.statsStrip}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{xp}</Text>
                <Text style={styles.statLbl}>XP</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{lessonsCompleted}</Text>
                <Text style={styles.statLbl}>Lessons</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{streakDays}</Text>
                <Text style={styles.statLbl}>Streak</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.botBucks }]}>{botBucks}</Text>
                <Text style={styles.statLbl}>Bucks</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Guest upgrade CTA */}
          {isGuest && (
            <TouchableOpacity
              style={styles.guestCta}
              activeOpacity={0.9}
              onPress={goToCreateAccount}
            >
              <View style={styles.guestCtaIcon}>
                <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              </View>
              <View style={styles.guestCtaText}>
                <Text style={styles.guestCtaTitle}>Save your progress</Text>
                <Text style={styles.guestCtaBody}>
                  Create a free account to keep your XP, streak and Bot Bucks across devices.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Notifications */}
          <Text style={styles.sectionTitle}>Notifications</Text>
          {!notifSupported && (
            <View style={styles.notifBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.notifBannerText}>
                Notifications need a native rebuild. Run{' '}
                <Text style={styles.notifBannerCode}>npx expo run:ios</Text>
                {' '}from the mobile folder, then reopen the app.
              </Text>
            </View>
          )}
          <View style={[styles.prefCard, !notifSupported && styles.notifGridDisabled]}>
            <View style={styles.prefRow}>
              <View style={styles.prefLeft}>
                <Ionicons
                  name={notifOn ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.prefLabel}>Notifications</Text>
              </View>
              {notifLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Switch
                  value={notifOn}
                  onValueChange={toggleNotifications}
                  disabled={notifSyncing}
                  trackColor={{ false: colors.border, true: colors.primary + '88' }}
                  thumbColor={notifOn ? colors.primary : colors.textMuted}
                  ios_backgroundColor={colors.border}
                />
              )}
            </View>
          </View>
          <Text style={styles.notifHint}>
            {notifSupported
              ? `Reminders to keep your streak alive and get back to learning${notifSyncing ? ' · syncing…' : ''}`
              : 'Your choice is saved but won\u2019t fire until you rebuild the app.'}
          </Text>

          {/* Preferences */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefCard}>
            <View style={styles.prefRow}>
              <View style={styles.prefLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.primary} />
                <Text style={styles.prefLabel}>Dark mode</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={isDark ? colors.primary : colors.textMuted}
              />
            </View>
          </View>

          {/* Goals */}
          <Text style={styles.sectionTitle}>Your goals</Text>
          <View style={styles.goalsGrid}>
            {GOALS.map((goal) => {
              const selected = selectedGoals.includes(goal.key);
              const saving = savingGoalKey === goal.key;
              return (
                <TouchableOpacity
                  key={goal.key}
                  style={[styles.goalChip, selected && styles.goalChipSel]}
                  activeOpacity={0.85}
                  onPress={() => toggleGoal(goal.key)}
                  disabled={!!savingGoalKey}
                >
                  <View style={[styles.goalIconWrap, selected && styles.goalIconWrapSel]}>
                    {saving ? (
                      <ActivityIndicator size="small" color={selected ? colors.background : colors.primary} />
                    ) : (
                      <Ionicons name={goal.icon} size={18} color={selected ? colors.background : colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.goalLabel, selected && styles.goalLabelSel]} numberOfLines={2}>
                    {goal.label}
                  </Text>
                  {selected && !saving && (
                    <View style={styles.goalCheck}>
                      <Ionicons name="checkmark" size={11} color={colors.background} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.notifHint}>Tap to add or remove goals — we tailor your journey to these.</Text>

          {/* Invite friends to the app */}
          {!isGuest && (
            <>
              <Text style={styles.sectionTitle}>Invite friends</Text>
              <TouchableOpacity
                style={styles.guestCta}
                activeOpacity={0.9}
                onPress={() => {
                  const rootNav = navigation.getParent?.() ?? navigation;
                  rootNav.navigate('MyInvites');
                }}
              >
                <View style={styles.guestCtaIcon}>
                  <Ionicons name="mail-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.guestCtaText}>
                  <Text style={styles.guestCtaTitle}>Your invite codes</Text>
                  <Text style={styles.guestCtaBody}>
                    Share up to 10 join links. Friends paste the code when they sign up.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          {/* Support & legal */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.linkGrid}>
            <LinkTile icon="document-text-outline" label="Terms" onPress={() => openLegal('terms')} colors={colors} styles={styles} />
            <LinkTile icon="shield-checkmark-outline" label="Privacy" onPress={() => openLegal('privacy')} colors={colors} styles={styles} />
            <LinkTile icon="mail-outline" label="Contact" onPress={() => Linking.openURL(`mailto:${LEGAL.contactEmail}`)} colors={colors} styles={styles} />
            <LinkTile icon="globe-outline" label="Website" onPress={() => Linking.openURL('https://getmoneybot.com')} colors={colors} styles={styles} />
          </View>
          <Text style={styles.version}>MoneyBot v1.0.4</Text>

          {/* Account */}
          <View style={styles.accountSection}>
            <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.85} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={styles.signOutText}>{isGuest ? 'Exit Guest Session' : 'Sign Out'}</Text>
            </TouchableOpacity>
            {!isGuest && (
              <TouchableOpacity
                style={styles.deleteBtn}
                activeOpacity={0.7}
                onPress={deletingAccount ? undefined : confirmDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteText}>
                  {deletingAccount ? 'Deleting…' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>

      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit your name</Text>
            <Text style={styles.modalSub}>This is used to greet you and personalize reminders.</Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>First Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editFirst}
                onChangeText={setEditFirst}
                placeholder="Jordan"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Last Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editLast}
                onChangeText={setEditLast}
                placeholder="Rivera"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={saveProfile}
              />
            </View>

            {profileError ? <Text style={styles.modalError}>{profileError}</Text> : null}

            <TouchableOpacity style={styles.modalSaveBtn} activeOpacity={0.85} onPress={saveProfile} disabled={savingProfile}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.modalSaveGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {savingProfile ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} activeOpacity={0.7} onPress={() => setProfileOpen(false)} disabled={savingProfile}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: tabBarInset },

  heroCard: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
  },
  heroEditBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
    backgroundColor: 'rgba(61,220,95,0.1)',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  statsStrip: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.white },
  statLbl: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  statDiv: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  guestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(61,220,95,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.3)',
    padding: 16,
    marginBottom: 24,
  },
  guestCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.14)',
  },
  guestCtaText: { flex: 1 },
  guestCtaTitle: { fontSize: 15, fontWeight: '800', color: colors.white, marginBottom: 2 },
  guestCtaBody: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },

  notifGridDisabled: { opacity: 0.55 },
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(61,220,95,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
    padding: 12,
    marginBottom: 12,
  },
  notifBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  notifBannerCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.primary,
    fontWeight: '600',
  },
  notifHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },

  prefCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: colors.white },

  linkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  linkTile: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkTileLabel: { fontSize: 14, fontWeight: '600', color: colors.white },
  version: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    marginTop: 4,
  },

  accountSection: { gap: 12, alignItems: 'center' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.error },
  deleteBtn: { paddingVertical: 8 },
  deleteText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Goals
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  goalChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  goalChipSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  goalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)',
  },
  goalIconWrapSel: { backgroundColor: colors.primary },
  goalLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSecondary, lineHeight: 17 },
  goalLabelSel: { color: colors.white },
  goalCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.3, marginBottom: 6 },
  modalSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 18 },
  modalInputGroup: { gap: 6, marginBottom: 14 },
  modalLabel: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
  },
  modalError: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  modalSaveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  modalSaveGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  modalSaveText: { color: colors.background, fontSize: 17, fontWeight: '800' },
  modalCancel: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
