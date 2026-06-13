import Constants from 'expo-constants';

// Read the API base URL from app.json -> expo.extra.apiUrl.
// Set that to your deployed Railway URL (e.g. https://APP.up.railway.app/api)
// for production / TestFlight builds.
const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

const configured = (extra.apiUrl || '').trim();

// During local development the placeholder is left in place, so fall back to the
// local Django server. iOS Simulator can reach localhost; a physical device needs
// the deployed URL (or your Mac's LAN IP).
const LOCAL_FALLBACK = 'http://localhost:8000/api';

export const API_BASE_URL =
  configured && !configured.includes('REPLACE') ? configured : LOCAL_FALLBACK;
