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
import { useUserProgress, getRankMeta } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { BrandAvatar, BrandToast } from '../components/brand';
import ScreenAppBar, { screenAppBarTitleStyles } from '../components/ScreenAppBar';
import PuckButton from '../components/PuckButton';
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

const NOTIF_ROWS = [
  { key: 'daily', label: 'Daily reminders', hint: 'A 6pm ping to hop into a lesson', icon: 'sunny-outline' },
  { key: 'streak', label: 'Streak alerts', hint: 'Only when your streak is actually at risk', icon: 'flame-outline' },
  { key: 'newContent', label: 'Product updates', hint: 'New lessons and MoneyBot news', icon: 'megaphone-outline' },
];

const GOAL_CELEB_KEY = 'goalCelebratedV1';

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
    onboardingGoals, updateGoals, modules,
    loading: progressLoading,
  } = useUserProgress();
  const { registerPush } = useNotifications();
  const rankMeta = getRankMeta(rank?.key);
  const { colors, isDark, toggleTheme } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const titleStyles = useMemo(() => screenAppBarTitleStyles(colors), [colors]);

  const [notifPrefs, setNotifPrefs] = useState({ daily: true, streak: true, newContent: false });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSyncing, setNotifSyncing] = useState(false);
  const [permInfo, setPermInfo] = useState({ supported: true, status: 'undetermined', canAskAgain: true });
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [goalToast, setGoalToast] = useState(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
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

  const refreshPermInfo = useCallback(async () => {
    const info = await getNotificationPermissionInfo();
    setPermInfo(info);
    return info;
  }, []);

  function openLegal(document) {
    const rootNav = navigation.getParent?.() ?? navigation;
    rootNav.navigate('Legal', { document });
  }

  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      setNotifPrefs(prefs);
      setNotifLoading(false);
    });
    refreshPermInfo();
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

  const notifOn = notifPrefs.daily || notifPrefs.streak || notifPrefs.newContent;
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

  const toggleNotifications = useCallback(async (value) => {
    await applyNotifPrefs({ daily: value, streak: value, newContent: value });
  }, [applyNotifPrefs]);

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

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenAppBar
          showBack={false}
          rightActions={(
            <TouchableOpacity
              style={styles.menuBtn}
              activeOpacity={0.85}
              onPress={() => setSettingsMenuOpen(true)}
              accessibilityLabel="Open quick settings"
            >
              <Ionicons name="menu" size={20} color={colors.white} />
            </TouchableOpacity>
          )}
        >
          <View style={styles.identity}>
            <View style={styles.identityAvatar}>
              <Ionicons name="person" size={18} color={colors.primary} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={titleStyles.title} numberOfLines={1}>Settings</Text>
              <Text style={titleStyles.eyebrow} numberOfLines={1}>Profile & preferences</Text>
            </View>
          </View>
        </ScreenAppBar>

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
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.heroTop}>
              <BrandAvatar character={equippedCharacter} size={52} autoRotate={!!equippedCharacter} />
              <View style={styles.heroIdentity}>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.heroEmail} numberOfLines={1}>{emailDisplay}</Text>
                <View style={styles.chipRow}>
                  {rank && (
                    <View style={[styles.chip, { borderColor: rankMeta.color + '55', backgroundColor: rankMeta.color + '1A' }]}>
                      <Ionicons name={rankMeta.ionIcon} size={11} color={rankMeta.color} />
                      <Text style={[styles.chipText, { color: rankMeta.color }]}>{rank.label}</Text>
                    </View>
                  )}
                  <View style={styles.chip}>
                    <Text style={[styles.chipText, { color: colors.primary }]}>Lv {level}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.statsStrip}>
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.streak }]}>{streakDays}</Text>
                <Text style={styles.statLbl}>Streak</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.botBucks }]}>{botBucks}</Text>
                <Text style={styles.statLbl}>Bucks</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{lessonsCompleted}</Text>
                <Text style={styles.statLbl}>Lessons</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{xp}</Text>
                <Text style={styles.statLbl}>XP</Text>
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

          {/* Quick settings entry — notifications + dark mode live in the menu (top-right). */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.85}
            onPress={() => setSettingsMenuOpen(true)}
          >
            <View style={styles.menuRowIcon}>
              <Ionicons name="options-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuRowTitle}>Notifications & appearance</Text>
              <Text style={styles.menuRowSub}>Reminders, streak alerts, dark mode</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Goals */}
          <Text style={styles.sectionTitle}>Your goals</Text>
          {GOALS.filter((g) => !selectedGoals.includes(g.key)).slice(0, 1).map((goal) => (
            <TouchableOpacity
              key={`suggest-${goal.key}`}
              style={styles.suggestChip}
              activeOpacity={0.85}
              onPress={() => toggleGoal(goal.key)}
            >
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.suggestText}>Try adding {goal.label}</Text>
            </TouchableOpacity>
          ))}
          {GOALS.map((goal) => {
            const selected = selectedGoals.includes(goal.key);
            const saving = savingGoalKey === goal.key;
            const { done, total } = goalLessonProgress(goal.key, modules);
            const pct = total > 0 ? Math.round((done / total) * 100) : null;
            const facts = [
              total > 0
                ? `${done} of ${total} matching lessons`
                : (lessonsCompleted ? `${lessonsCompleted} lessons overall · start this topic on Home` : 'Start a matching lesson on Home'),
              streakDays ? `${streakDays}-day streak` : null,
              typeof botBucks === 'number' ? `${botBucks} Bot Bucks` : null,
            ].filter(Boolean);
            return (
              <View key={goal.key} style={[styles.goalCard, selected && styles.goalCardSel]}>
                <View style={styles.goalTop}>
                  <View style={[styles.goalIconWrap, selected && styles.goalIconWrapSel]}>
                    <Ionicons name={goal.icon} size={20} color={selected ? colors.background : colors.primary} />
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={styles.goalTitle}>{goal.label}</Text>
                    <Text style={styles.goalFacts} numberOfLines={2}>{facts.join(' · ')}</Text>
                  </View>
                  <PuckButton
                    color={selected ? colors.primary : colors.surfaceElevated}
                    width={68}
                    height={40}
                    borderRadius={14}
                    lip={5}
                    disabled={!!savingGoalKey}
                    onPress={() => toggleGoal(goal.key)}
                    contentStyle={styles.goalPuckContent}
                    accessibilityLabel={selected ? `Remove ${goal.label}` : `Add ${goal.label}`}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={selected ? colors.background : colors.primary} />
                    ) : (
                      <Text style={[styles.goalPuckText, { color: selected ? colors.background : colors.white }]}>
                        {selected ? 'On' : 'Add'}
                      </Text>
                    )}
                  </PuckButton>
                </View>
                {pct != null && (
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${pct}%` }]} />
                  </View>
                )}
              </View>
            );
          })}
          <Text style={styles.notifHint}>Progress is lessons in that topic, plus your real streak and Bot Bucks — not a made-up score.</Text>

          {/* Support & legal */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.linkGrid}>
            <LinkTile icon="document-text-outline" label="Terms" onPress={() => openLegal('terms')} colors={colors} styles={styles} />
            <LinkTile icon="shield-checkmark-outline" label="Privacy" onPress={() => openLegal('privacy')} colors={colors} styles={styles} />
            <LinkTile icon="mail-outline" label="Contact" onPress={() => Linking.openURL(`mailto:${LEGAL.contactEmail}`)} colors={colors} styles={styles} />
            <LinkTile icon="globe-outline" label="Website" onPress={() => Linking.openURL('https://getmoneybot.com')} colors={colors} styles={styles} />
          </View>
          <Text style={styles.version}>MoneyBot v1.0.7</Text>

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

      {/* Quick settings sheet: all the on/off toggles in one place */}
      <Modal visible={settingsMenuOpen} transparent animationType="slide" onRequestClose={() => setSettingsMenuOpen(false)}>
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setSettingsMenuOpen(false)}
        >
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Settings</Text>
              <TouchableOpacity
                onPress={() => setSettingsMenuOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
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
              {permDenied && notifSupported && (
                <View style={styles.notifBanner}>
                  <Ionicons name="notifications-off-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifBannerText}>
                      Notifications are off in iOS Settings. Turn on Alerts for MoneyBot, then return here.
                    </Text>
                    <TouchableOpacity
                      onPress={() => openSystemNotificationSettings()}
                      style={styles.openSettingsBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.openSettingsText}>Open Settings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.sheetLabel}>NOTIFICATIONS</Text>
              <View style={[styles.prefCard, !notifSupported && styles.notifGridDisabled]}>
                <View style={styles.prefRow}>
                  <View style={styles.prefLeft}>
                    <Ionicons
                      name={notifOn ? 'notifications' : 'notifications-off-outline'}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.prefLabel}>All reminders</Text>
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
                {NOTIF_ROWS.map((row, index) => (
                  <View key={row.key} style={[styles.prefRow, styles.prefRowNested, index < NOTIF_ROWS.length - 1 && styles.prefRowBorder]}>
                    <View style={styles.prefLeft}>
                      <Ionicons name={row.icon} size={18} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prefLabel}>{row.label}</Text>
                        <Text style={styles.prefHint}>{row.hint}</Text>
                      </View>
                    </View>
                    <Switch
                      value={!!notifPrefs[row.key]}
                      onValueChange={(value) => toggleNotifPref(row.key, value)}
                      disabled={notifSyncing || notifLoading}
                      trackColor={{ false: colors.border, true: colors.primary + '88' }}
                      thumbColor={notifPrefs[row.key] ? colors.primary : colors.textMuted}
                      ios_backgroundColor={colors.border}
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.notifHint}>
                {notifSupported
                  ? `Turning a type off cancels those local reminders${notifSyncing ? ' · syncing…' : ''}`
                  : 'Your choice is saved but won\u2019t fire until you rebuild the app.'}
              </Text>

              <Text style={styles.sheetLabel}>APPEARANCE</Text>
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
            </ScrollView>

            <PuckButton
              color={colors.primary}
              height={52}
              borderRadius={16}
              lip={5}
              onPress={() => setSettingsMenuOpen(false)}
              contentStyle={styles.sheetDoneInner}
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </PuckButton>
          </TouchableOpacity>
        </TouchableOpacity>
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
  scroll: { paddingHorizontal: 20, paddingBottom: tabBarInset },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    height: 44,
  },
  identityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    flexShrink: 0,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  menuRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)',
  },
  menuRowTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  menuRowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Quick settings sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '82%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  sheetScroll: { paddingBottom: 8 },
  sheetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sheetDoneInner: { alignItems: 'center', justifyContent: 'center' },
  sheetDoneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  heroCard: {
    borderRadius: 18,
    padding: 14,
    paddingTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
  },
  heroEditBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingRight: 28,
  },
  heroIdentity: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
    backgroundColor: 'rgba(61,220,95,0.1)',
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  statsStrip: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '800', color: colors.white },
  statLbl: { fontSize: 9, color: colors.textMuted, marginTop: 1, fontWeight: '600' },
  statDiv: { width: 1, backgroundColor: colors.border, marginVertical: 2 },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -6,
    marginBottom: 10,
    lineHeight: 17,
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
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  prefHint: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  prefRowNested: { paddingTop: 4 },
  prefRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  openSettingsBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  openSettingsText: { fontSize: 13, fontWeight: '800', color: colors.background },

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
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  suggestText: { fontSize: 13, fontWeight: '700', color: colors.white },
  goalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  goalCardSel: {
    borderColor: colors.primaryTintStrong,
    backgroundColor: colors.primaryTint,
  },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalCopy: { flex: 1, minWidth: 0 },
  goalTitle: { fontSize: 16, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
  goalFacts: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17, fontWeight: '500' },
  goalPuckContent: { alignItems: 'center', justifyContent: 'center' },
  goalPuckText: { fontSize: 13, fontWeight: '800' },
  goalTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)',
  },
  goalIconWrapSel: { backgroundColor: colors.primary },

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
