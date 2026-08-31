import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UserProgressProvider, useUserProgress } from './src/context/UserProgressContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BrandEmptyState, WelcomeSplash } from './src/components/brand';
import { API_BASE_URL } from './src/config/api';
import { bootstrapNotifications, syncStreakNotifications } from './src/utils/notifications';
import { getFirstName } from './src/utils/displayName';
import { localDate } from './src/utils/localDate';
import { warmModelViewerOnBoot } from './src/utils/modelCache';
import { ensureCacheScope } from './src/utils/apiCache';
import { navigationRef, flushPendingNotificationNavigation } from './src/navigation/rootNavigation';
import {
  ANALYTICS_EVENTS,
  getActiveRouteName,
  getPostHogClient,
  identifyUser,
  resetAnalytics,
  screen as captureScreen,
  track,
  trackAppOpened,
} from './src/utils/analytics';
import { initPurchases, logOutPurchases } from './src/services/purchases';
import LandingScreen from './src/screens/LandingScreen';
import AuthScreen from './src/screens/AuthScreen';
import LegalDocumentScreen from './src/screens/LegalDocumentScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MyInvitesScreen from './src/screens/MyInvitesScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import NameCapturePrompt from './src/components/NameCapturePrompt';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

function AnalyticsBridge() {
  const { user, isGuest, loading } = useAuth();
  const { onboardingCompleted, loading: progressLoading } = useUserProgress();
  const identifiedRef = useRef(null);
  const onboardingBaselineRef = useRef(null);

  useEffect(() => {
    trackAppOpened();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user?.id && !isGuest) {
      if (identifiedRef.current !== user.id) {
        identifyUser(String(user.id));
        initPurchases(user.id).catch(() => {});
        identifiedRef.current = user.id;
      }
      return;
    }
    if (identifiedRef.current) {
      resetAnalytics();
      logOutPurchases().catch(() => {});
      identifiedRef.current = null;
    }
  }, [user?.id, isGuest, loading]);

  useEffect(() => {
    if (loading || progressLoading) return;
    if (onboardingBaselineRef.current === null) {
      onboardingBaselineRef.current = !!onboardingCompleted;
      return;
    }
    if (!onboardingBaselineRef.current && onboardingCompleted) {
      track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED);
    }
    onboardingBaselineRef.current = !!onboardingCompleted;
  }, [loading, progressLoading, onboardingCompleted]);

  return null;
}

function NotificationForegroundSync() {
  const { user } = useAuth();
  const { streakDays, lastActive } = useUserProgress();

  useEffect(() => {
    if (!user) return undefined;

    const syncOnActive = () => {
      syncStreakNotifications({
        firstName: getFirstName(user),
        streakDays,
        activeToday: lastActive === localDate(),
      }).catch(() => {});
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncOnActive();
      }
    });

    return () => subscription.remove();
  }, [user, streakDays, lastActive]);

  return null;
}

function BootErrorScreen({ message, onRetry }) {
  const { colors } = useTheme();
  const styles = makeBootErrorStyles(colors);

  return (
    <View style={styles.screen}>
      <BrandEmptyState
        title="Couldn't load your account"
        body={`${message}\n\nConnected to:\n${API_BASE_URL}\n\nThis usually means the backend needs a database migration — not that you need to redo onboarding.`}
        style={{ marginTop: 80 }}
      />
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const {
    onboardingCompleted, loading: progressLoading, loadError, refresh, equippedCharacter,
  } = useUserProgress();
  const [splashDone, setSplashDone] = useState(false);

  // Wait for auth and (when signed in) the first stats fetch, so we know
  // whether to show onboarding before rendering the main app.
  const booting = loading || (user && progressLoading);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onLayout = useCallback(async () => {
    await SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (booting || !splashDone) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <WelcomeSplash
          firstName={getFirstName(user)}
          character={equippedCharacter}
          ready={!booting}
          onDone={() => setSplashDone(true)}
        />
      </View>
    );
  }

  if (user && !onboardingCompleted && loadError) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <BootErrorScreen message={loadError} onRetry={() => refresh({ showLoading: true })} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          flushPendingNotificationNavigation();
          captureScreen(getActiveRouteName(navigationRef.getRootState()));
        }}
        onStateChange={(state) => {
          captureScreen(getActiveRouteName(state));
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {user ? (
            <>
              {onboardingCompleted ? (
                <Stack.Screen name="Main" component={MainTabNavigator} />
              ) : (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              )}
              {/* Lets a signed-in guest open the auth screen to upgrade their
                  account. Uses a distinct name so a fresh login (which swaps
                  the whole logged-out stack) never gets stuck on this route. */}
              <Stack.Screen
                name="AuthUpgrade"
                component={AuthScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="MyInvites"
                component={MyInvitesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen
                name="Auth"
                component={AuthScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
            </>
          )}
          <Stack.Screen
            name="Legal"
            component={LegalDocumentScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const makeBootErrorStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    alignSelf: 'center',
    marginTop: 28,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default function App() {
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    ensureCacheScope()
      .then(() => {
        warmModelViewerOnBoot();
        bootstrapNotifications().catch(() => {});
      })
      .finally(() => setCacheReady(true));
  }, []);

  if (!cacheReady) {
    return null;
  }

  const posthog = getPostHogClient();
  const tree = (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <UserProgressProvider>
            <NotificationsProvider>
              <AnalyticsBridge />
              <NotificationForegroundSync />
              <RootNavigator />
              <NameCapturePrompt />
            </NotificationsProvider>
          </UserProgressProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  if (!posthog) return tree;

  return (
    <PostHogProvider
      client={posthog}
      autocapture={false}
    >
      {tree}
    </PostHogProvider>
  );
}
