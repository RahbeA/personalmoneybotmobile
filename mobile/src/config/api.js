// Production Railway backend (TestFlight / prod testing).
export const PRODUCTION_API_URL =
  'https://moneybotmobile-production.up.railway.app/api';

// Local Django when running `python manage.py runserver` on the Mac.
// iOS Simulator can reach localhost; a physical device needs your Mac's LAN IP.
export const LOCAL_API_URL = 'http://localhost:8000/api';

// In dev builds, default to the local backend. Set EXPO_PUBLIC_USE_PRODUCTION_API=1
// when you want the dev client to hit Railway instead.
const useProductionInDev = process.env.EXPO_PUBLIC_USE_PRODUCTION_API === '1';

export const API_BASE_URL =
  !__DEV__ || useProductionInDev ? PRODUCTION_API_URL : LOCAL_API_URL;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[MoneyBot] API:', API_BASE_URL);
}
