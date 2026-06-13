import React, { useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UserProgressProvider, useUserProgress } from './src/context/UserProgressContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BrandLoader } from './src/components/brand';
import { LOADER_MESSAGES } from './src/constants/brandCopy';
import { bootstrapNotifications } from './src/utils/notifications';
import LandingScreen from './src/screens/LandingScreen';
import AuthScreen from './src/screens/AuthScreen';
import LegalDocumentScreen from './src/screens/LegalDocumentScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  const { onboardingCompleted, loading: progressLoading } = useUserProgress();
  const { colors } = useTheme();

  // Wait for auth and (when signed in) the first stats fetch, so we know
  // whether to show onboarding before rendering the main app.
  const booting = loading || (user && progressLoading);

  useEffect(() => {
    if (!booting) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [booting]);

  // Safety net — never stay stuck on the native splash screen.
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const onLayout = useCallback(async () => {
    if (!booting) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [booting]);

  if (booting) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <BrandLoader message={LOADER_MESSAGES.boot} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {user ? (
            onboardingCompleted ? (
              <Stack.Screen name="Main" component={MainTabNavigator} />
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )
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

export default function App() {
  useEffect(() => {
    bootstrapNotifications().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <UserProgressProvider>
            <RootNavigator />
          </UserProgressProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
