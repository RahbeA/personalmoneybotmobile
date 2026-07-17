import { Alert } from 'react-native';

/**
 * Prompt a guest to create a free account before using an account-based feature.
 * Apple Guideline 5.1.1(v) allows gating truly social / sync features behind signup
 * as long as non-account content (lessons, etc.) stays freely accessible.
 *
 * @returns {boolean} true if the user already has a real account (action may proceed)
 */
export function requireAccount({ isGuest, navigation, feature }) {
  if (!isGuest) return true;

  const featureLabel = feature || 'this feature';
  Alert.alert(
    'Account required',
    `Create a free account to ${featureLabel}. Learning content stays available without signing up.`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Create Account',
        onPress: () => {
          const rootNav = navigation?.getParent?.() ?? navigation;
          rootNav?.navigate?.('AuthUpgrade', { mode: 'register' });
        },
      },
    ],
  );
  return false;
}
