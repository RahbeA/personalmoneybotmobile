import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Route social push / in-app notification taps into the Social tab.
 * Works from cold start and background because the root navigator is Main → tabs.
 */
export function handleNotificationNavigation(data = {}) {
  if (!navigationRef.isReady()) return;

  const kind = data.kind;

  // Invite reward lives on the root stack (sibling of Main), not the Social tab.
  if (kind === 'invite_reward') {
    navigationRef.dispatch(CommonActions.navigate({ name: 'MyInvites' }));
    return;
  }

  let socialScreen = 'Friends';
  if (kind === 'friend_request') socialScreen = 'FriendRequests';
  else if (kind === 'friend_accepted' || kind === 'friend_declined' || kind === 'friend_nudge') {
    socialScreen = 'MyFriends';
  } else if (kind === 'announcement') socialScreen = 'Notifications';

  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Main',
      params: {
        screen: 'SocialTab',
        params: {
          screen: socialScreen,
        },
      },
    }),
  );
}
