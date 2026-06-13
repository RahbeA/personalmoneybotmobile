import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import CoursesScreen from '../screens/CoursesScreen';
import LessonIntroScreen from '../screens/LessonIntroScreen';
import QuestionFlowScreen from '../screens/QuestionFlowScreen';
import LessonCompleteScreen from '../screens/LessonCompleteScreen';
import ModuleCompleteScreen from '../screens/ModuleCompleteScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MoneyverseScreen from '../screens/MoneyverseScreen';
import CharacterDetailScreen from '../screens/CharacterDetailScreen';
import TutorScreen from '../screens/TutorScreen';
import MoneyChatScreen from '../screens/MoneyChatScreen';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();
const CourseStack = createNativeStackNavigator();
const MoneyverseStack = createNativeStackNavigator();
const TutorStack = createNativeStackNavigator();

const TABS = [
  { name: 'HomeTab', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'CoursesTab', label: 'Courses', icon: 'book', iconOutline: 'book-outline' },
  { name: 'MoneyverseTab', label: 'Moneyverse', icon: 'planet', iconOutline: 'planet', featured: true },
  { name: 'TutorTab', label: 'Tutor', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  { name: 'SettingsTab', label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
];

const LESSON_ROUTES = new Set(['LessonIntro', 'QuestionFlow', 'LessonComplete', 'ModuleComplete', 'MoneyChat']);

function getDeepestRouteName(route) {
  if (!route.state) return route.name;
  const nestedRoute = route.state.routes[route.state.index];
  return getDeepestRouteName(nestedRoute);
}

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const currentTabRoute = state.routes[state.index];
  const focusedRouteName = getDeepestRouteName(currentTabRoute);
  if (LESSON_ROUTES.has(focusedRouteName)) return null;

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab, index) => {
        const isFocused = state.index === index;
        const isDisabled = tab.disabled;

        if (tab.featured) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.featuredItem}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(tab.name)}
            >
              <LinearGradient
                colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.featuredButton, isFocused && styles.featuredButtonActive]}
              >
                <Ionicons name="planet" size={24} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.featuredLabel, isFocused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            activeOpacity={isDisabled ? 1 : 0.7}
            onPress={() => {
              if (isDisabled) return;
              navigation.navigate(tab.name);
            }}
          >
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Ionicons
                name={isFocused ? tab.icon : tab.iconOutline}
                size={22}
                color={isDisabled ? colors.textMuted : isFocused ? colors.primary : colors.textSecondary}
              />
              {isFocused && !tab.featured && <View style={styles.activeDot} />}
            </View>
            <Text
              style={[
                styles.tabLabel,
                isFocused && styles.tabLabelActive,
                isDisabled && styles.tabLabelDisabled,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MoneyverseStackNavigator() {
  return (
    <MoneyverseStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <MoneyverseStack.Screen name="Moneyverse" component={MoneyverseScreen} />
      <MoneyverseStack.Screen name="CharacterDetail" component={CharacterDetailScreen} options={{ animation: 'slide_from_bottom' }} />
    </MoneyverseStack.Navigator>
  );
}

function CoursesStackNavigator() {
  return (
    <CourseStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <CourseStack.Screen name="CourseMap" component={CoursesScreen} />
      <CourseStack.Screen name="LessonIntro" component={LessonIntroScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <CourseStack.Screen name="QuestionFlow" component={QuestionFlowScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <CourseStack.Screen name="LessonComplete" component={LessonCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <CourseStack.Screen name="MoneyChat" component={MoneyChatScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <CourseStack.Screen name="ModuleComplete" component={ModuleCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
    </CourseStack.Navigator>
  );
}

function TutorStackNavigator() {
  return (
    <TutorStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <TutorStack.Screen name="Tutor" component={TutorScreen} />
    </TutorStack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="CoursesTab" component={CoursesStackNavigator} />
      <Tab.Screen name="MoneyverseTab" component={MoneyverseStackNavigator} />
      <Tab.Screen name="TutorTab" component={TutorStackNavigator} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  featuredItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  featuredButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  featuredButtonActive: {
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  featuredLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: colors.primaryTint,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabLabelDisabled: {
    color: colors.textMuted,
  },
});
