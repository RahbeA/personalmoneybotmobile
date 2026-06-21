import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Matches CustomTabBar body height (icons, labels, padding) — not the bottom safe inset. */
export const TAB_BAR_BODY_HEIGHT = 74;

/** Bottom inset so scroll content clears the overlay tab bar. */
export function useTabBarInset(extra = 0) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BODY_HEIGHT + Math.max(insets.bottom, 8) + extra;
}
