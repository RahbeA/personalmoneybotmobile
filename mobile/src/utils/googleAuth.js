import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import {
  GOOGLE_IOS_REDIRECT_URI,
  getGoogleAuthRequestConfig,
} from '../config/google';

/** True when running inside the Expo Go app (Google OAuth is not supported there). */
export function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

/**
 * Build the config passed to Google.useIdTokenAuthRequest.
 * Dev/production builds on iOS must use Google's reversed client-ID redirect scheme.
 */
export function buildGoogleAuthConfig() {
  const config = { ...getGoogleAuthRequestConfig() };

  if (Platform.OS === 'ios') {
    config.redirectUri = GOOGLE_IOS_REDIRECT_URI;
  } else if (Platform.OS === 'android') {
    config.redirectUri = makeRedirectUri({
      scheme: 'moneybot',
      path: 'oauthredirect',
    });
  }

  return config;
}

export function getGoogleSignInBlockedMessage() {
  if (isExpoGo()) {
    return (
      'Google sign-in does not work in Expo Go. Run a development build instead:\n\n' +
      '  cd mobile && npx expo run:ios'
    );
  }
  return null;
}
