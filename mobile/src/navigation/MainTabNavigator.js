import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ArcadeScreen from '../screens/arcade/ArcadeScreen';
import BudgetBlitzScreen from '../games/budgetBlitz/BudgetBlitzScreen';
import DailyBlitzScreen from '../screens/daily/DailyBlitzScreen';
import DailyLeaderboardScreen from '../screens/daily/DailyLeaderboardScreen';
import InflationDodgeScreen from '../games/inflationDodge/InflationDodgeScreen';
import CreditClimbScreen from '../games/creditClimb/CreditClimbScreen';
import ScamSpotterScreen from '../games/scamSpotter/ScamSpotterScreen';
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
import BadgeRevealScreen from '../screens/BadgeRevealScreen';
import FriendsScreen from '../screens/social/FriendsScreen';
import FriendRequestsScreen from '../screens/social/FriendRequestsScreen';
import NotificationsScreen from '../screens/social/NotificationsScreen';
import GroupsScreen from '../screens/social/GroupsScreen';
import CreateGroupScreen from '../screens/social/CreateGroupScreen';
import GroupDetailScreen from '../screens/social/GroupDetailScreen';
import InviteFriendsScreen from '../screens/social/InviteFriendsScreen';
import GroupLeaderboardScreen from '../screens/social/GroupLeaderboardScreen';
import CreateChallengeScreen from '../screens/social/CreateChallengeScreen';
import ChallengeLeaderboardScreen from '../screens/social/ChallengeLeaderboardScreen';
import { useTheme } from '../context/ThemeContext';
import { useUserProgress } from '../context/UserProgressContext';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const CourseStack = createNativeStackNavigator();
const MoneyverseStack = createNativeStackNavigator();
const TutorStack = createNativeStackNavigator();
const SocialStack = createNativeStackNavigator();

const TABS = [
  { name: 'HomeTab', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'CoursesTab', label: 'Courses', icon: 'book', iconOutline: 'book-outline' },
  { name: 'MoneyverseTab', label: 'Moneyverse', icon: 'planet', iconOutline: 'planet-outline' },
  { name: 'SocialTab', label: 'Friends', icon: 'people', iconOutline: 'people-outline' },
  { name: 'TutorTab', label: 'Tutor', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  { name: 'SettingsTab', label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
];

const LESSON_ROUTES = new Set([
  'LessonIntro', 'QuestionFlow', 'LessonComplete', 'ModuleComplete', 'MoneyChat', 'BadgeReveal',
  'Arcade', 'BudgetBlitz', 'InflationDodge', 'CreditClimb', 'ScamSpotter', 'DailyBlitz', 'DailyLeaderboard',
  'Groups', 'CreateGroup', 'GroupDetail', 'InviteFriends', 'GroupLeaderboard', 'CreateChallenge', 'ChallengeLeaderboard',
  'FriendRequests', 'Notifications', 'CharacterDetail',
]);

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
                size={28}
                color={isDisabled ? colors.textMuted : isFocused ? colors.primary : colors.textSecondary}
              />
              {isFocused && <View style={styles.activeDot} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function HomeStackNavigator() {
  const { colors } = useTheme();
  const badgeRevealOptions = {
    animation: 'slide_from_right',
    gestureEnabled: false,
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <HomeStack.Screen name="Arcade" component={ArcadeScreen} />
      <HomeStack.Screen
        name="BudgetBlitz"
        component={BudgetBlitzScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <HomeStack.Screen
        name="InflationDodge"
        component={InflationDodgeScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <HomeStack.Screen
        name="CreditClimb"
        component={CreditClimbScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <HomeStack.Screen
        name="ScamSpotter"
        component={ScamSpotterScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <HomeStack.Screen
        name="DailyBlitz"
        component={DailyBlitzScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <HomeStack.Screen name="DailyLeaderboard" component={DailyLeaderboardScreen} />
      <HomeStack.Screen
        name="BadgeReveal"
        component={BadgeRevealScreen}
        options={badgeRevealOptions}
      />
    </HomeStack.Navigator>
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
  const { colors } = useTheme();
  const badgeRevealOptions = {
    animation: 'slide_from_right',
    gestureEnabled: false,
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <CourseStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <CourseStack.Screen name="CourseMap" component={CoursesScreen} />
      <CourseStack.Screen name="LessonIntro" component={LessonIntroScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <CourseStack.Screen name="QuestionFlow" component={QuestionFlowScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <CourseStack.Screen name="LessonComplete" component={LessonCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <CourseStack.Screen name="MoneyChat" component={MoneyChatScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <CourseStack.Screen name="ModuleComplete" component={ModuleCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <CourseStack.Screen
        name="DailyBlitz"
        component={DailyBlitzScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <CourseStack.Screen name="DailyLeaderboard" component={DailyLeaderboardScreen} />
      <CourseStack.Screen
        name="BadgeReveal"
        component={BadgeRevealScreen}
        options={badgeRevealOptions}
      />
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

function SocialStackNavigator() {
  return (
    <SocialStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <SocialStack.Screen name="Friends" component={FriendsScreen} />
      <SocialStack.Screen name="FriendRequests" component={FriendRequestsScreen} />
      <SocialStack.Screen name="Notifications" component={NotificationsScreen} />
      <SocialStack.Screen name="Groups" component={GroupsScreen} />
      <SocialStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <SocialStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <SocialStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <SocialStack.Screen name="GroupLeaderboard" component={GroupLeaderboardScreen} />
      <SocialStack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
      <SocialStack.Screen name="ChallengeLeaderboard" component={ChallengeLeaderboardScreen} />
    </SocialStack.Navigator>
  );
}

export default function MainTabNavigator() {
  const { colors } = useTheme();
  const { pendingFirstLesson } = useUserProgress();

  return (
    <Tab.Navigator
      // Right after onboarding, land on the Courses tab so it can push the
      // user straight into their first lesson.
      initialRouteName={pendingFirstLesson ? 'CoursesTab' : 'HomeTab'}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="CoursesTab" component={CoursesStackNavigator} />
      <Tab.Screen name="MoneyverseTab" component={MoneyverseStackNavigator} />
      <Tab.Screen name="SocialTab" component={SocialStackNavigator} />
      <Tab.Screen name="TutorTab" component={TutorStackNavigator} options={{ lazy: true }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingVertical: 6,
  },
  iconWrap: {
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconWrapActive: {
    backgroundColor: colors.primaryTint,
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -2.5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
});
