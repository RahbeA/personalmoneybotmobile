import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingNotificationData = null;

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

const ROOT_SCREENS = new Set(['AuthUpgrade', 'Legal']);

const TAB_BY_HINT = {
  Home: 'HomeTab',
  HomeTab: 'HomeTab',
  Learn: 'HomeTab',
  DailyBlitz: 'HomeTab',
  Moneyverse: 'MoneyverseTab',
  MoneyverseTab: 'MoneyverseTab',
  CharacterDetail: 'MoneyverseTab',
  Social: 'SocialTab',
  SocialTab: 'SocialTab',
  Friends: 'SocialTab',
  Leaderboard: 'SocialTab',
  Notifications: 'SocialTab',
  MyFriends: 'SocialTab',
  FriendRequests: 'SocialTab',
  Feed: 'SocialTab',
  Tutor: 'TutorTab',
  TutorTab: 'TutorTab',
  Settings: 'SettingsTab',
  SettingsTab: 'SettingsTab',
  Profile: 'SettingsTab',
};

const SOCIAL_BY_KIND = {
  friend_request: 'FriendRequests',
  friend_accepted: 'MyFriends',
  friend_declined: 'MyFriends',
  friend_nudge: 'MyFriends',
  announcement: 'Notifications',
};

function navigateSocial(screen) {
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Main',
      params: {
        screen: 'SocialTab',
        params: { screen },
      },
    }),
  );
}

function navigateTab(tab, nestedScreen) {
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Main',
      params: nestedScreen
        ? { screen: tab, params: { screen: nestedScreen } }
        : { screen: tab },
    }),
  );
}

export function flushPendingNotificationNavigation() {
  if (!pendingNotificationData || !navigationRef.isReady()) return;
  const data = pendingNotificationData;
  pendingNotificationData = null;
  handleNotificationNavigation(data);
}

/**
 * Route social push / in-app notification taps into the right screen.
 * Works from cold start and background because we queue until the root nav is ready.
 */
export function handleNotificationNavigation(data = {}) {
  const payload = data && typeof data === 'object' ? data : {};
  if (!navigationRef.isReady()) {
    pendingNotificationData = payload;
    return;
  }

  const kind = payload.kind;
  const hint = payload.screen || payload.route || payload.target;

  if (kind === 'invite_reward') {
    navigateTab('HomeTab');
    return;
  }

  if (hint && ROOT_SCREENS.has(hint)) {
    navigationRef.dispatch(CommonActions.navigate({ name: hint }));
    return;
  }

  if (hint && TAB_BY_HINT[hint]) {
    const tab = TAB_BY_HINT[hint];
    const nested = ['HomeTab', 'SettingsTab'].includes(tab) ? undefined : hint;
    navigateTab(tab, nested && nested !== tab ? nested : undefined);
    return;
  }

  if (SOCIAL_BY_KIND[kind]) {
    navigateSocial(SOCIAL_BY_KIND[kind]);
    return;
  }

  // Local reminders and unknown/missing kinds land on Home — never dump
  // a daily nudge onto Friends by accident.
  navigateTab('HomeTab');
}
