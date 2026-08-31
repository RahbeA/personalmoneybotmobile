/**
 * Open the Premium paywall. Prefers a Paywall route on the current stack
 * (Moneyverse), then walks parents so root Paywall still works.
 */
export function openPaywall(navigation) {
  if (!navigation?.navigate) return;

  let nav = navigation;
  while (nav) {
    const names = nav.getState?.()?.routeNames;
    if (names?.includes('Paywall')) {
      nav.navigate('Paywall');
      return;
    }
    nav = nav.getParent?.();
  }

  navigation.navigate('Paywall');
}

export function isPremiumLocked(item, isPremium) {
  return !!(item?.is_premium && !isPremium && !item?.is_owned);
}
