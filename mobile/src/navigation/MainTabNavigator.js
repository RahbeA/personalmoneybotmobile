import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
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
import MyFriendsScreen from '../screens/social/MyFriendsScreen';
import FriendRequestsScreen from '../screens/social/FriendRequestsScreen';
import NotificationsScreen from '../screens/social/NotificationsScreen';
import GroupsScreen from '../screens/social/GroupsScreen';
import CreateGroupScreen from '../screens/social/CreateGroupScreen';
import GroupDetailScreen from '../screens/social/GroupDetailScreen';
import InviteFriendsScreen from '../screens/social/InviteFriendsScreen';
import GroupLeaderboardScreen from '../screens/social/GroupLeaderboardScreen';
import CreateChallengeScreen from '../screens/social/CreateChallengeScreen';
import ChallengeLeaderboardScreen from '../screens/social/ChallengeLeaderboardScreen';
import FeedScreen from '../screens/feed/FeedScreen';
import ComposeFeedScreen from '../screens/feed/ComposeFeedScreen';
import ContactInviteScreen from '../screens/social/ContactInviteScreen';
import PaywallScreen from '../screens/PaywallScreen';
import { useTheme } from '../context/ThemeContext';
import { useUserProgress } from '../context/UserProgressContext';
import { TabReselectProvider, TAB_ROOT_SCREENS, emitTabReselect, useTabReselectContext } from './tabReselect';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const MoneyverseStack = createNativeStackNavigator();
const TutorStack = createNativeStackNavigator();
const SocialStack = createNativeStackNavigator();

const TABS = [
  { name: 'HomeTab', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'MoneyverseTab', label: 'Moneyverse', icon: 'planet', iconOutline: 'planet-outline' },
  { name: 'SocialTab', label: 'Leaderboard', icon: 'trophy', iconOutline: 'trophy-outline' },
  { name: 'TutorTab', label: 'Tutor', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  { name: 'SettingsTab', label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
];

const LESSON_ROUTES = new Set([
  'LessonIntro', 'QuestionFlow', 'LessonComplete', 'ModuleComplete', 'MoneyChat', 'BadgeReveal',
  'Arcade', 'BudgetBlitz', 'InflationDodge', 'CreditClimb', 'ScamSpotter', 'DailyBlitz', 'DailyLeaderboard',
  'Groups', 'CreateGroup', 'GroupDetail', 'InviteFriends', 'GroupLeaderboard', 'CreateChallenge', 'ChallengeLeaderboard',
  'FriendRequests', 'Notifications', 'MyFriends', 'CharacterDetail',
  'ComposeFeed', 'Paywall',
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
  const reselect = useTabReselectContext();

  const currentTabRoute = state.routes[state.index];
  const focusedRouteName = getDeepestRouteName(currentTabRoute);
  const hideBar = LESSON_ROUTES.has(focusedRouteName);

  if (hideBar) return null;

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

              const route = state.routes[index];
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;

              if (!isFocused) {
                navigation.navigate(tab.name);
                return;
              }

              const nested = route.state;
              if (nested?.index > 0 && nested.key) {
                navigation.dispatch({
                  ...StackActions.popToTop(),
                  target: nested.key,
                });
              }

              reselect?.emit
                ? reselect.emit(tab.name, { screen: TAB_ROOT_SCREENS[tab.name] })
                : emitTabReselect(tab.name, { screen: TAB_ROOT_SCREENS[tab.name] });
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
      <HomeStack.Screen name="LessonIntro" component={LessonIntroScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <HomeStack.Screen name="QuestionFlow" component={QuestionFlowScreen} options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <HomeStack.Screen name="LessonComplete" component={LessonCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <HomeStack.Screen name="MoneyChat" component={MoneyChatScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <HomeStack.Screen name="ModuleComplete" component={ModuleCompleteScreen} options={{ animation: 'fade', gestureEnabled: false }} />
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
      <HomeStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </HomeStack.Navigator>
  );
}

function MoneyverseStackNavigator() {
  return (
    <MoneyverseStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <MoneyverseStack.Screen name="Moneyverse" component={MoneyverseScreen} />
      <MoneyverseStack.Screen name="CharacterDetail" component={CharacterDetailScreen} options={{ animation: 'slide_from_bottom' }} />
      <MoneyverseStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </MoneyverseStack.Navigator>
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
      <SocialStack.Screen name="MyFriends" component={MyFriendsScreen} />
      <SocialStack.Screen name="FriendRequests" component={FriendRequestsScreen} />
      <SocialStack.Screen name="Notifications" component={NotificationsScreen} />
      <SocialStack.Screen name="Groups" component={GroupsScreen} />
      <SocialStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <SocialStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <SocialStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <SocialStack.Screen name="GroupLeaderboard" component={GroupLeaderboardScreen} />
      <SocialStack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
      <SocialStack.Screen name="ChallengeLeaderboard" component={ChallengeLeaderboardScreen} />
      <SocialStack.Screen name="Feed" component={FeedScreen} />
      <SocialStack.Screen name="ComposeFeed" component={ComposeFeedScreen} options={{ animation: 'slide_from_bottom' }} />
      <SocialStack.Screen name="ContactInvite" component={ContactInviteScreen} />
    </SocialStack.Navigator>
  );
}

export default function MainTabNavigator() {
  const { colors } = useTheme();
  const { pendingMoneyverseIntro } = useUserProgress();

  return (
    <TabReselectProvider>
      <Tab.Navigator
        // Right after onboarding, land on Moneyverse to meet the free starter
        // character. (pendingFirstLesson kept for older clients / edge cases.)
        initialRouteName={pendingMoneyverseIntro ? 'MoneyverseTab' : 'HomeTab'}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
        <Tab.Screen name="MoneyverseTab" component={MoneyverseStackNavigator} />
        <Tab.Screen name="SocialTab" component={SocialStackNavigator} />
        <Tab.Screen name="TutorTab" component={TutorStackNavigator} options={{ lazy: true }} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} />
      </Tab.Navigator>
    </TabReselectProvider>
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
