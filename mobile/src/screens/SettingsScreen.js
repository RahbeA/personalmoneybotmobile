import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  Switch, Alert, ActivityIndicator, Linking, Platform, KeyboardAvoidingView, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { BrandAvatar, BrandToast } from '../components/brand';
import { LEGAL } from '../constants/legal';
import { GOALS } from '../constants/goals';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
  areNotificationsSupported,
  getNotificationsUnavailableMessage,
  getNotificationPermissionInfo,
  openSystemNotificationSettings,
} from '../utils/notifications';
import { getFirstName } from '../utils/displayName';
import { localDate } from '../utils/localDate';

const GOAL_KEYWORDS = {
  emergency_fund: ['emergenc', 'saving', 'save'],
  pay_off_debt: ['debt'],
  start_investing: ['invest', 'stock'],
  budget_better: ['budget'],
  boost_credit: ['credit'],
  save_big_goal: ['saving', 'save', 'emergenc'],
};

// The two reminder toggles shown in the REMINDERS card (map to notif prefs).
const REMINDER_ROWS = [
  { key: 'daily', label: 'Daily reminder', hint: '6pm nudge to do a lesson', icon: 'sunny-outline' },
  { key: 'streak', label: 'Streak alerts', hint: 'Get warned when your streak is at risk', icon: 'flame-outline' },
];

const GOAL_CELEB_KEY = 'goalCelebratedV1';
const REDUCE_MOTION_KEY = 'reduceMotionV1';

function goalLessonProgress(goalKey, modules = []) {
  const needles = GOAL_KEYWORDS[goalKey] || [];
  let done = 0;
  let total = 0;
  (modules || []).forEach((mod) => {
    const hay = `${mod.title || ''} ${mod.description || ''}`.toLowerCase();
    if (!needles.some((n) => hay.includes(n))) return;
    const lessons = mod.lessons || [];
    if (lessons.length) {
      total += lessons.length;
      done += lessons.filter((l) => l.is_completed).length;
    } else {
      total += mod.lesson_count || 0;
      done += mod.completed_lesson_count || 0;
    }
  });
  if (done > total) done = total;
  return { done, total };
}

export default function SettingsScreen({ navigation }) {
  const { user, isGuest, updateProfile, logout, deleteAccount } = useAuth();
  const {
    xp, streakDays, lastActive, level, lessonsCompleted, botBucks, equippedCharacter,
    xpInCurrentLevel, XP_PER_LEVEL, xpProgress,
    onboardingGoals, updateGoals, modules,
    loading: progressLoading,
  } = useUserProgress();
  const { registerPush } = useNotifications();
  const { colors, isDark, toggleTheme } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [notifPrefs, setNotifPrefs] = useState({ daily: true, streak: true, newContent: false });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSyncing, setNotifSyncing] = useState(false);
  const [permInfo, setPermInfo] = useState({ supported: true, status: 'undetermined', canAskAgain: true });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [goalToast, setGoalToast] = useState(null);
  const celebratedRef = useRef({});
  const goalBaselineReady = useRef(false);

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
  const emailDisplay = isGuest ? 'Guest — saved on this device' : (user?.email || '');

  const xpPct = Math.max(0, Math.min(1, xpProgress || 0));
  const xpToNext = Math.max(0, (XP_PER_LEVEL || 200) - (xpInCurrentLevel || 0));

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

  const refreshPermInfo = useCallback(async () => {
    const info = await getNotificationPermissionInfo();
    setPermInfo(info);
    return info;
  }, []);

  function openLegal(document) {
    const rootNav = navigation.getParent?.() ?? navigation;
    rootNav.navigate('Legal', { document });
  }

  const setReduceMotionPref = useCallback((value) => {
    setReduceMotion(value);
    SecureStore.setItemAsync(REDUCE_MOTION_KEY, value ? '1' : '0').catch(() => {});
  }, []);

  function comingSoon(feature) {
    Alert.alert(feature, 'More options are on the way. English is the only language for now.');
  }

  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      setNotifPrefs(prefs);
      setNotifLoading(false);
    });
    refreshPermInfo();
    SecureStore.getItemAsync(REDUCE_MOTION_KEY).then((raw) => {
      if (raw === '1') setReduceMotion(true);
    }).catch(() => {});
    SecureStore.getItemAsync(GOAL_CELEB_KEY).then((raw) => {
      try {
        celebratedRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        celebratedRef.current = {};
      }
    }).catch(() => {});
  }, [refreshPermInfo]);

  useFocusEffect(useCallback(() => {
    refreshPermInfo();
  }, [refreshPermInfo]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPermInfo();
    });
    return () => sub.remove();
  }, [refreshPermInfo]);

  useEffect(() => {
    if (!user?.id || progressLoading) return;
    let shouldSave = false;
    if (!goalBaselineReady.current) {
      selectedGoals.forEach((key) => {
        const { done, total } = goalLessonProgress(key, modules);
        const celebKey = `${user.id}:${key}`;
        if (total > 0 && done >= total) {
          celebratedRef.current[celebKey] = true;
          shouldSave = true;
        }
      });
      goalBaselineReady.current = true;
      if (shouldSave) {
        SecureStore.setItemAsync(GOAL_CELEB_KEY, JSON.stringify(celebratedRef.current)).catch(() => {});
      }
      return;
    }
    selectedGoals.forEach((key) => {
      const { done, total } = goalLessonProgress(key, modules);
      const celebKey = `${user.id}:${key}`;
      if (total > 0 && done >= total && !celebratedRef.current[celebKey]) {
        celebratedRef.current[celebKey] = true;
        shouldSave = true;
        const goal = GOALS.find((g) => g.key === key);
        setGoalToast(`${goal?.label || 'Goal'} crushed — ${done} lesson${done === 1 ? '' : 's'} done.`);
      }
    });
    if (shouldSave) {
      SecureStore.setItemAsync(GOAL_CELEB_KEY, JSON.stringify(celebratedRef.current)).catch(() => {});
    }
  }, [selectedGoals, modules, user?.id, progressLoading]);

  const permDenied = permInfo.status === 'denied';

  const applyNotifPrefs = useCallback(async (next) => {
    if (!notifSupported) {
      Alert.alert('Rebuild Required', getNotificationsUnavailableMessage());
      return;
    }
    const previous = notifPrefs;
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
      const info = await refreshPermInfo();
      if (!result.ok && result.reason === 'permission_denied') {
        Alert.alert(
          'Notifications Off',
          'Enable notifications in iOS Settings, then come back to MoneyBot.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSystemNotificationSettings() },
          ],
        );
        const reverted = { daily: false, streak: false, newContent: false };
        setNotifPrefs(reverted);
        await saveNotificationPrefs(reverted);
        return;
      }
      if (info.status === 'granted' && (next.daily || next.streak || next.newContent)) {
        await registerPush?.();
      }
    } catch (err) {
      Alert.alert('Could Not Update', err.message || 'Try again in a moment.');
      setNotifPrefs(previous);
    } finally {
      setNotifSyncing(false);
    }
  }, [notifPrefs, notifSupported, user, streakDays, lastActive, refreshPermInfo, registerPush]);

  const toggleNotifPref = useCallback(async (key, value) => {
    await applyNotifPrefs({ ...notifPrefs, [key]: value });
  }, [applyNotifPrefs, notifPrefs]);

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

  const switchColors = {
    trackColor: { false: colors.border, true: colors.primary },
    thumbColor: '#FFFFFF',
    ios_backgroundColor: colors.border,
  };

  const appRows = [
    {
      key: 'appearance',
      icon: 'color-palette-outline',
      label: 'Appearance',
      value: isDark ? 'Dark' : 'Light',
      onPress: toggleTheme,
    },
    {
      key: 'language',
      icon: 'language-outline',
      label: 'Language',
      value: 'English',
      onPress: () => comingSoon('Language'),
    },
    {
      key: 'legal',
      icon: 'document-text-outline',
      label: 'Terms & privacy',
      onPress: () => openLegal('terms'),
    },
    {
      key: 'support',
      icon: 'mail-outline',
      label: 'Contact support',
      onPress: () => Linking.openURL(`mailto:${LEGAL.contactEmail}`),
    },
    {
      key: 'website',
      icon: 'globe-outline',
      label: 'getmoneybot.com',
      onPress: () => Linking.openURL('https://getmoneybot.com'),
    },
  ];

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Profile header */}
          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <BrandAvatar character={equippedCharacter} size={64} autoRotate={!!equippedCharacter} />
            </View>
            <View style={styles.profileCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  activeOpacity={0.8}
                  onPress={openProfileEditor}
                  accessibilityLabel="Edit name"
                >
                  <Ionicons name="pencil" size={13} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.email} numberOfLines={1}>{emailDisplay}</Text>
              <View style={styles.levelRow}>
                <View style={styles.levelPill}>
                  <Text style={styles.levelPillText}>LEVEL {level}</Text>
                </View>
                <Text style={styles.xpText}>{xpInCurrentLevel} / {XP_PER_LEVEL} XP</Text>
              </View>
            </View>
          </View>

          {/* XP progress */}
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.round(xpPct * 100)}%` }]} />
          </View>
          <Text style={styles.xpCaption}>{xpToNext} XP to level {level + 1}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Ionicons name="flame" size={22} color={colors.streak} />
              <Text style={styles.statValue}>{streakDays}</Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
            <View style={styles.statTile}>
              <View style={styles.coin}><Text style={styles.coinText}>$</Text></View>
              <Text style={styles.statValue}>{botBucks}</Text>
              <Text style={styles.statLabel}>Bot Bucks</Text>
            </View>
            <View style={styles.statTile}>
              <Ionicons name="school" size={22} color={colors.primary} />
              <Text style={styles.statValue}>{lessonsCompleted}</Text>
              <Text style={styles.statLabel}>Lessons</Text>
            </View>
            <View style={styles.statTile}>
              <Ionicons name="flash" size={22} color={colors.primary} />
              <Text style={styles.statValue}>{xp}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
          </View>

          {/* Guest upgrade */}
          {isGuest && (
            <TouchableOpacity style={styles.guestCta} activeOpacity={0.9} onPress={goToCreateAccount}>
              <View style={styles.guestCtaIcon}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestCtaTitle}>Save your progress</Text>
                <Text style={styles.guestCtaBody}>Create a free account to keep your XP, streak and Bot Bucks.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Goals */}
          <Text style={styles.sectionLabel}>WHAT YOU'RE WORKING ON</Text>
          <View style={styles.goalWrap}>
            {GOALS.map((goal) => {
              const selected = selectedGoals.includes(goal.key);
              const saving = savingGoalKey === goal.key;
              return (
                <TouchableOpacity
                  key={goal.key}
                  activeOpacity={0.85}
                  disabled={!!savingGoalKey}
                  onPress={() => toggleGoal(goal.key)}
                  style={[styles.goalPill, selected && styles.goalPillSel]}
                >
                  <Ionicons
                    name={goal.icon}
                    size={17}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.goalPillText, selected && styles.goalPillTextSel]}>{goal.label}</Text>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'add'}
                      size={selected ? 18 : 17}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Lessons on these topics get pushed up your path first.</Text>

          {/* Reminders */}
          <Text style={styles.sectionLabel}>REMINDERS</Text>
          <View style={styles.card}>
            {REMINDER_ROWS.map((row, index) => (
              <View key={row.key} style={[styles.settingRow, index < REMINDER_ROWS.length && styles.rowBorder]}>
                <View style={styles.rowIcon}>
                  <Ionicons name={row.icon} size={19} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowHint}>{row.hint}</Text>
                </View>
                {notifLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    value={!!notifPrefs[row.key]}
                    onValueChange={(value) => toggleNotifPref(row.key, value)}
                    disabled={notifSyncing}
                    {...switchColors}
                  />
                )}
              </View>
            ))}
            <View style={styles.settingRow}>
              <View style={styles.rowIcon}>
                <Ionicons name="accessibility-outline" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowLabel}>Reduce motion</Text>
                <Text style={styles.rowHint}>Calmer transitions and no bobbing</Text>
              </View>
              <Switch value={reduceMotion} onValueChange={setReduceMotionPref} {...switchColors} />
            </View>
          </View>
          {permDenied && notifSupported && (
            <TouchableOpacity style={styles.permRow} activeOpacity={0.85} onPress={() => openSystemNotificationSettings()}>
              <Ionicons name="notifications-off-outline" size={15} color={colors.textMuted} />
              <Text style={styles.permText}>Notifications are off in iOS Settings. Tap to open.</Text>
            </TouchableOpacity>
          )}

          {/* App */}
          <Text style={styles.sectionLabel}>APP</Text>
          <View style={styles.card}>
            {appRows.map((row, index) => (
              <TouchableOpacity
                key={row.key}
                activeOpacity={0.8}
                onPress={row.onPress}
                style={[styles.settingRow, index < appRows.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={row.icon} size={19} color={colors.primary} />
                </View>
                <Text style={styles.rowLabelFlex}>{row.label}</Text>
                {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Account */}
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.85} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>{isGuest ? 'Exit guest session' : 'Sign out'}</Text>
          </TouchableOpacity>
          {!isGuest && (
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.7}
              onPress={deletingAccount ? undefined : confirmDeleteAccount}
              disabled={deletingAccount}
            >
              <Text style={styles.deleteText}>{deletingAccount ? 'Deleting…' : 'Delete account'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.version}>MoneyBot v1.0.7</Text>

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

      <BrandToast
        visible={!!goalToast}
        message={goalToast}
        onHide={() => setGoalToast(null)}
      />
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: tabBarInset },

  // Profile header
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(61,220,95,0.4)',
    backgroundColor: colors.surfaceElevated,
  },
  profileCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 26, fontWeight: '900', color: colors.white, letterSpacing: -0.5, flexShrink: 1 },
  editBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  levelPill: {
    backgroundColor: 'rgba(61,220,95,0.14)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, color: colors.primary },
  xpText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // XP bar
  xpTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: 18,
  },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  xpCaption: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 8 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.botBucks,
  },
  coinText: { fontSize: 13, fontWeight: '900', color: '#3A2A00' },

  // Guest CTA
  guestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(61,220,95,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.3)',
    padding: 14,
    marginTop: 20,
  },
  guestCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.14)',
  },
  guestCtaTitle: { fontSize: 15, fontWeight: '800', color: colors.white, marginBottom: 2 },
  guestCtaBody: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 28,
    marginBottom: 12,
  },

  // Goals
  goalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  goalPillSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.1)' },
  goalPillText: { fontSize: 14, fontWeight: '700', color: colors.white },
  goalPillTextSel: { color: colors.white },
  hint: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 12, lineHeight: 17 },

  // Cards + rows
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 62,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.1)',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
  rowLabelFlex: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  rowHint: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginRight: 2 },

  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  permText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.textMuted, lineHeight: 16 },

  // Account
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.08)',
    marginTop: 28,
  },
  signOutText: { fontSize: 16, fontWeight: '800', color: colors.error },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  deleteText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  version: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
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
