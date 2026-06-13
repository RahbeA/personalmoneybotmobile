import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/** True when Sign in with Apple can be shown (iOS dev/production builds). */
export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
