import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, Linking, Platform,
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
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
  sendTestNotification,
  areNotificationsSupported,
  getNotificationsUnavailableMessage,
} from '../utils/notifications';

function NotifToggle({ icon, label, value, onChange, colors, styles }) {
  return (
    <View style={styles.notifTile}>
      <View style={styles.notifTop}>
        <View style={[styles.notifIcon, value && styles.notifIconOn]}>
          <Ionicons name={icon} size={20} color={value ? colors.primary : colors.textMuted} />
        </View>
        <Text style={styles.notifLabel}>{label}</Text>
      </View>
      <View style={styles.switchWrap}>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.primary + '88' }}
          thumbColor={value ? colors.primary : colors.textMuted}
          ios_backgroundColor={colors.border}
        />
      </View>
    </View>
  );
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
  const { user, logout, deleteAccount } = useAuth();
  const { xp, streakDays, level, lessonsCompleted, botBucks, equippedCharacter, rank } = useUserProgress();
  const rankMeta = getRankMeta(rank?.key);
  const { colors, isDark, toggleTheme } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [notifPrefs, setNotifPrefs] = useState({ daily: true, streak: true, newContent: false });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSyncing, setNotifSyncing] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const notifSupported = areNotificationsSupported();

  const emailDisplay = user?.email || '';
  const firstName = emailDisplay.split('@')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

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

  const updateNotifPref = useCallback(async (key, value) => {
    if (!notifSupported) {
      Alert.alert('Rebuild Required', getNotificationsUnavailableMessage());
      return;
    }
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    setNotifSyncing(true);
    try {
      await saveNotificationPrefs(next);
      const result = await syncNotificationSchedule(next);
      if (!result.ok && result.reason === 'permission_denied') {
        Alert.alert(
          'Notifications Off',
          'Enable notifications in your device Settings to receive reminders.',
        );
        const reverted = { ...next, [key]: false };
        setNotifPrefs(reverted);
        await saveNotificationPrefs(reverted);
      }
    } catch (err) {
      Alert.alert('Could Not Update', err.message || 'Try again in a moment.');
      setNotifPrefs(notifPrefs);
    } finally {
      setNotifSyncing(false);
    }
  }, [notifPrefs, notifSupported]);

  async function handleTestNotification() {
    setTestSending(true);
    try {
      await sendTestNotification('daily');
      Alert.alert('Sent!', 'A test notification will appear in about a second.');
    } catch (err) {
      Alert.alert('Test Failed', err.message || 'Could not send test notification.');
    } finally {
      setTestSending(false);
    }
  }

  function confirmLogout() {
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

          {/* Notifications */}
          <Text style={styles.sectionTitle}>Reminders</Text>
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
          <View style={[styles.notifGrid, !notifSupported && styles.notifGridDisabled]}>
            {notifLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.notifLoader} />
            ) : (
              <>
                <NotifToggle
                  icon="notifications-outline"
                  label="Daily"
                  value={notifPrefs.daily}
                  onChange={(v) => updateNotifPref('daily', v)}
                  colors={colors}
                  styles={styles}
                />
                <NotifToggle
                  icon="flame-outline"
                  label="Streak"
                  value={notifPrefs.streak}
                  onChange={(v) => updateNotifPref('streak', v)}
                  colors={colors}
                  styles={styles}
                />
                <NotifToggle
                  icon="sparkles-outline"
                  label="Updates"
                  value={notifPrefs.newContent}
                  onChange={(v) => updateNotifPref('newContent', v)}
                  colors={colors}
                  styles={styles}
                />
              </>
            )}
          </View>
          <Text style={styles.notifHint}>
            {notifSupported
              ? `Daily at 6 PM · Streak at 8 PM · Updates Mondays 10 AM${notifSyncing ? ' · syncing…' : ''}`
              : 'Toggles are saved but won\u2019t fire until you rebuild the app.'}
          </Text>

          {__DEV__ && notifSupported && (
            <TouchableOpacity
              style={styles.testBtn}
              activeOpacity={0.85}
              onPress={handleTestNotification}
              disabled={testSending}
            >
              {testSending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color={colors.background} />
                  <Text style={styles.testBtnText}>Send Test Notification</Text>
                </>
              )}
            </TouchableOpacity>
          )}

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

          {/* Support & legal */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.linkGrid}>
            <LinkTile icon="document-text-outline" label="Terms" onPress={() => openLegal('terms')} colors={colors} styles={styles} />
            <LinkTile icon="shield-checkmark-outline" label="Privacy" onPress={() => openLegal('privacy')} colors={colors} styles={styles} />
            <LinkTile icon="mail-outline" label="Contact" onPress={() => Linking.openURL(`mailto:${LEGAL.contactEmail}`)} colors={colors} styles={styles} />
            <LinkTile icon="globe-outline" label="Website" onPress={() => Linking.openURL('https://getmoneybot.com')} colors={colors} styles={styles} />
          </View>
          <Text style={styles.version}>MoneyBot v1.0.1</Text>

          {/* Account */}
          <View style={styles.accountSection}>
            <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.85} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
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
          </View>

        </ScrollView>
      </SafeAreaView>
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

  notifGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
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
  notifLoader: { flex: 1, paddingVertical: 24 },
  notifTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
    minHeight: 118,
  },
  notifTop: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconOn: { backgroundColor: 'rgba(61,220,95,0.15)' },
  notifLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  switchWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 31,
    marginTop: 4,
  },
  notifHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },

  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  testBtnText: { fontSize: 15, fontWeight: '700', color: colors.background },

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
});
