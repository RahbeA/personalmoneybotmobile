import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

function StatCard({ label, value, delay }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  function confirmLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of MoneyBot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: handleLogout,
        },
      ]
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const emailDisplay = user?.email || 'user@moneybot.com';
  const firstName = emailDisplay.split('@')[0];
  const displayName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  return (
    <LinearGradient colors={['#0A0A0A', '#0F1A0F', '#0A0A0A']} style={styles.gradient}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerAnim,
                transform: [
                  {
                    translateY: headerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.greeting}>Good morning,</Text>
                <Text style={styles.username}>{displayName} 👋</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={confirmLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutIcon}>{loggingOut ? '⏳' : '→'}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Hero Card */}
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: contentAnim,
                transform: [
                  {
                    translateY: contentAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[colors.primaryDark, '#1A5C2A', '#0F3A1A']}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroDot} />
              <Text style={styles.heroLabel}>Total Balance</Text>
              <Text style={styles.heroBalance}>$0.00</Text>
              <Text style={styles.heroSub}>Connect your accounts to get started</Text>
            </LinearGradient>
          </Animated.View>

          {/* Stats Row */}
          <Animated.View
            style={[styles.statsRow, { opacity: contentAnim }]}
          >
            <StatCard label="Income" value="$0" delay={100} />
            <StatCard label="Expenses" value="$0" delay={200} />
            <StatCard label="Savings" value="0%" delay={300} />
          </Animated.View>

          {/* Welcome Banner */}
          <Animated.View style={[styles.welcomeBanner, { opacity: contentAnim }]}>
            <View style={styles.welcomeIconContainer}>
              <Text style={styles.welcomeIcon}>🤖</Text>
            </View>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeTitle}>Welcome to MoneyBot!</Text>
              <Text style={styles.welcomeBody}>
                Your AI-powered financial assistant is ready. Connect your accounts to unlock insights.
              </Text>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View style={[styles.section, { opacity: contentAnim }]}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              {quickActions.map((action, i) => (
                <TouchableOpacity key={i} style={styles.actionItem} activeOpacity={0.7}>
                  <View style={styles.actionIcon}>
                    <Text style={styles.actionEmoji}>{action.icon}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Account + email display */}
          <Animated.View style={[styles.accountRow, { opacity: contentAnim }]}>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <View style={styles.accountBadge}>
              <View style={styles.accountDot} />
              <Text style={styles.accountEmail}>{emailDisplay}</Text>
            </View>
          </Animated.View>

          {/* Sign Out */}
          <Animated.View style={[styles.signOutContainer, { opacity: contentAnim }]}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={confirmLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutText}>
                {loggingOut ? 'Signing out...' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const quickActions = [
  { icon: '💳', label: 'Link Account' },
  { icon: '📊', label: 'Analytics' },
  { icon: '🔔', label: 'Alerts' },
  { icon: '⚙️', label: 'Settings' },
];

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  greeting: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  heroGradient: {
    padding: 28,
    borderRadius: 20,
    minHeight: 160,
    justifyContent: 'center',
  },
  heroDot: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    opacity: 0.6,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroBalance: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeBanner: {
    backgroundColor: 'rgba(61, 220, 95, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(61, 220, 95, 0.2)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  welcomeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(61, 220, 95, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  welcomeIcon: {
    fontSize: 22,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  welcomeBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionItem: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  accountLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  accountEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  signOutContainer: {
    alignItems: 'center',
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.3)',
    backgroundColor: 'rgba(255, 77, 77, 0.06)',
  },
  signOutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
});
