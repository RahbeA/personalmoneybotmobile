// Google OAuth client IDs (Google Cloud Console > APIs & Services > Credentials).
// Every ID listed here must also appear in backend GOOGLE_CLIENT_IDS.

const IOS_CLIENT_ID =
  '153959048568-ji63jtsd7eo4e6u1bpn7743t34l15hu0.apps.googleusercontent.com';

// Required for Expo Go (uses the web OAuth flow).
const WEB_CLIENT_ID = '';

const ANDROID_CLIENT_ID = '';

// iOS native redirect — must match the URL scheme registered in app.json.
export const GOOGLE_IOS_REDIRECT_URI =
  'com.googleusercontent.apps.153959048568-ji63jtsd7eo4e6u1bpn7743t34l15hu0:/oauthredirect';

export const GOOGLE_CLIENT_IDS = {
  webClientId: WEB_CLIENT_ID,
  iosClientId: IOS_CLIENT_ID,
  androidClientId: ANDROID_CLIENT_ID,
};

/** Config object for expo-auth-session — omits empty / unset IDs. */
export function getGoogleAuthRequestConfig() {
  const config = {};
  if (GOOGLE_CLIENT_IDS.webClientId) config.webClientId = GOOGLE_CLIENT_IDS.webClientId;
  if (GOOGLE_CLIENT_IDS.iosClientId) config.iosClientId = GOOGLE_CLIENT_IDS.iosClientId;
  if (GOOGLE_CLIENT_IDS.androidClientId) config.androidClientId = GOOGLE_CLIENT_IDS.androidClientId;
  return config;
}

export const isGoogleConfigured = Boolean(
  GOOGLE_CLIENT_IDS.webClientId || GOOGLE_CLIENT_IDS.iosClientId,
);
